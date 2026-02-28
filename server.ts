/**
 * 飞书长连接 → Cursor Agent CLI 中继服务 v3
 *
 * 直连方案：飞书 SDK ↔ Cursor Agent CLI
 * - 飞书消息直达 Cursor，零提示词污染
 * - 普通互动卡片回复 + 消息更新（无需 CardKit 权限）
 * - 支持文字、图片、语音、文件、富文本
 * - 长消息自动分片
 *
 * 启动: bun run server.ts
 */

import * as Lark from "@larksuiteoapi/node-sdk";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, watchFile, mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { gzipSync, gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const HOME = process.env.HOME;
if (!HOME) throw new Error("$HOME is not set");

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(import.meta.dirname, ".env");
const PROJECTS_PATH = resolve(ROOT, "projects.json");
const AGENT_BIN = process.env.AGENT_BIN || resolve(HOME, ".local/bin/agent");
const INBOX_DIR = resolve(ROOT, "inbox");

mkdirSync(INBOX_DIR, { recursive: true });

// 启动时清理超过 24h 的临时文件
const DAY_MS = 24 * 60 * 60 * 1000;
for (const f of readdirSync(INBOX_DIR)) {
	const p = resolve(INBOX_DIR, f);
	try { if (Date.now() - statSync(p).mtimeMs > DAY_MS) unlinkSync(p); } catch {}
}

process.on("uncaughtException", (err) => {
	console.error(`[致命] ${err.message}\n${err.stack}`);
});
process.on("unhandledRejection", (reason) => {
	console.error("[致命] unhandledRejection:", reason);
});

// ── .env 热更换 ──────────────────────────────────
interface EnvConfig {
	CURSOR_API_KEY: string;
	FEISHU_APP_ID: string;
	FEISHU_APP_SECRET: string;
	CURSOR_MODEL: string;
	VOLC_STT_APP_ID: string;
	VOLC_STT_ACCESS_TOKEN: string;
}

function parseEnv(): EnvConfig {
	if (!existsSync(ENV_PATH)) {
		console.error(`[致命] .env 文件不存在: ${ENV_PATH}`);
		process.exit(1);
	}
	const raw = readFileSync(ENV_PATH, "utf-8");
	const env: Record<string, string> = {};
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx < 0) continue;
		let val = trimmed.slice(eqIdx + 1).trim();
		// 去除引号包裹
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		env[trimmed.slice(0, eqIdx).trim()] = val;
	}
	return {
		CURSOR_API_KEY: env.CURSOR_API_KEY || "",
		FEISHU_APP_ID: env.FEISHU_APP_ID || "",
		FEISHU_APP_SECRET: env.FEISHU_APP_SECRET || "",
		CURSOR_MODEL: env.CURSOR_MODEL || "opus-4.6-thinking",
		VOLC_STT_APP_ID: env.VOLC_STT_APP_ID || "",
		VOLC_STT_ACCESS_TOKEN: env.VOLC_STT_ACCESS_TOKEN || "",
	};
}

let config = parseEnv();
watchFile(ENV_PATH, { interval: 2000 }, () => {
	try {
		const prev = config.CURSOR_API_KEY;
		config = parseEnv();
		if (config.CURSOR_API_KEY !== prev) {
			console.log(`[热更换] API Key 已更新 (...${config.CURSOR_API_KEY.slice(-8)})`);
		} else {
			console.log("[热更换] .env 已重新加载");
		}
	} catch {}
});

// ── 项目配置 ─────────────────────────────────────
interface ProjectsConfig {
	projects: Record<string, { path: string; description: string }>;
	default_project: string;
}
if (!existsSync(PROJECTS_PATH)) {
	console.error(`[致命] projects.json 不存在: ${PROJECTS_PATH}`);
	process.exit(1);
}
let projectsConfig: ProjectsConfig = JSON.parse(readFileSync(PROJECTS_PATH, "utf-8"));
watchFile(PROJECTS_PATH, { interval: 5000 }, () => {
	try {
		projectsConfig = JSON.parse(readFileSync(PROJECTS_PATH, "utf-8"));
	} catch {}
});

// ── 飞书 Client ──────────────────────────────────
const larkClient = new Lark.Client({
	appId: config.FEISHU_APP_ID,
	appSecret: config.FEISHU_APP_SECRET,
	domain: Lark.Domain.Feishu,
});

// ── 卡片构建 ─────────────────────────────────────
function buildCard(markdown: string, header?: { title?: string; color?: string }): string {
	const card: Record<string, unknown> = {
		schema: "2.0",
		config: { wide_screen_mode: true },
		body: { elements: [{ tag: "markdown", content: markdown }] },
	};
	if (header) {
		const h: Record<string, unknown> = { template: header.color || "blue" };
		if (header.title) h.title = { tag: "plain_text", content: header.title };
		card.header = h;
	}
	return JSON.stringify(card);
}

// ── 飞书消息操作 ─────────────────────────────────
async function replyCard(
	messageId: string,
	markdown: string,
	header?: { title?: string; color?: string },
): Promise<string | undefined> {
	try {
		const res = await larkClient.im.message.reply({
			path: { message_id: messageId },
			data: { content: buildCard(markdown, header), msg_type: "interactive" },
		});
		return res.data?.message_id;
	} catch (err) {
		console.error("[回复卡片失败]", err);
		try {
			const res = await larkClient.im.message.reply({
				path: { message_id: messageId },
				data: { content: JSON.stringify({ text: markdown }), msg_type: "text" },
			});
			return res.data?.message_id;
		} catch {}
	}
}

async function updateCard(
	messageId: string,
	markdown: string,
	header?: { title?: string; color?: string },
): Promise<void> {
	try {
		await larkClient.im.message.patch({
			path: { message_id: messageId },
			data: { content: buildCard(markdown, header) },
		});
	} catch (err) {
		console.error("[更新卡片失败]", err);
	}
}

async function sendCard(
	chatId: string,
	markdown: string,
	header?: { title?: string; color?: string },
): Promise<string | undefined> {
	try {
		const res = await larkClient.im.message.create({
			params: { receive_id_type: "chat_id" },
			data: { receive_id: chatId, msg_type: "interactive", content: buildCard(markdown, header) },
		});
		return res.data?.message_id;
	} catch (err) {
		console.error("[发送卡片失败]", err);
	}
}

// 长消息分片发送
const CARD_MAX = 3800;
async function replyLongMessage(messageId: string, chatId: string, text: string, header?: { title?: string; color?: string }): Promise<void> {
	if (text.length <= CARD_MAX) {
		await replyCard(messageId, text, header);
		return;
	}
	const chunks: string[] = [];
	let remaining = text;
	while (remaining.length > 0) {
		if (remaining.length <= CARD_MAX) {
			chunks.push(remaining);
			break;
		}
		let cut = remaining.lastIndexOf("\n", CARD_MAX);
		if (cut < CARD_MAX * 0.5) cut = CARD_MAX;
		chunks.push(remaining.slice(0, cut));
		remaining = remaining.slice(cut);
	}
	for (let i = 0; i < chunks.length; i++) {
		const h = chunks.length > 1 ? { title: `${header?.title || "回复"} (${i + 1}/${chunks.length})`, color: header?.color } : header;
		if (i === 0) await replyCard(messageId, chunks[i], h);
		else await sendCard(chatId, chunks[i], h);
	}
}

// ── 媒体下载 ─────────────────────────────────────
async function readResponseBuffer(response: unknown, depth = 0): Promise<Buffer> {
	if (depth > 3) throw new Error("readResponseBuffer: 响应嵌套过深");
	const resp = response as Record<string, unknown>;
	if (resp instanceof Readable || typeof (resp as Readable).pipe === "function") {
		const chunks: Buffer[] = [];
		for await (const chunk of resp as Readable) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
		}
		return Buffer.concat(chunks);
	}
	if (typeof resp.writeFile === "function") {
		const tmp = resolve(INBOX_DIR, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
		await (resp as { writeFile: (p: string) => Promise<void> }).writeFile(tmp);
		const buf = readFileSync(tmp);
		try { unlinkSync(tmp); } catch {}
		return buf;
	}
	if (Buffer.isBuffer(resp)) return resp;
	if (resp.data && resp.data !== resp) return readResponseBuffer(resp.data, depth + 1);
	throw new Error("无法解析飞书资源响应");
}

async function downloadMedia(
	messageId: string,
	fileKey: string,
	type: "image" | "file",
	ext: string,
): Promise<string> {
	const response = await larkClient.im.messageResource.get({
		path: { message_id: messageId, file_key: fileKey },
		params: { type },
	});
	const buffer = await readResponseBuffer(response);
	const filename = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
	const filepath = resolve(INBOX_DIR, filename);
	writeFileSync(filepath, buffer);
	console.log(`[下载] ${filepath} (${buffer.length} bytes)`);
	return filepath;
}

// ── 语音转文字（火山引擎 → 云端 API → 本地 whisper）──
const WHISPER_MODEL = resolve(HOME, ".cache/whisper-cpp/ggml-tiny.bin");
const WHISPER_BIN = process.env.WHISPER_CLI || "whisper-cli";
const STT_DEBUG = /^(whisper_|ggml_|main:|system_info:|metal_|coreml_|log_)/;

function convertToWav(audioPath: string): string {
	const wavPath = audioPath.replace(/\.[^.]+$/, ".wav");
	execFileSync("ffmpeg", ["-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wavPath], {
		timeout: 30_000,
		stdio: "pipe",
	});
	return wavPath;
}

// 火山引擎豆包大模型 STT（WebSocket 二进制协议）
// 协议文档: https://www.volcengine.com/docs/6561/1354869
const VOLC_STT_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
const VOLC_RESOURCE_ID = "volc.bigasr.sauc.duration";

function volcBuildHeader(msgType: number, flags: number, serial: number, compress: number): Buffer {
	const h = Buffer.alloc(4);
	h[0] = 0x11; // protocol v1, header_size = 4 bytes (1×4)
	h[1] = ((msgType & 0xF) << 4) | (flags & 0xF);
	h[2] = ((serial & 0xF) << 4) | (compress & 0xF);
	h[3] = 0x00;
	return h;
}

function volcBuildPacket(header: Buffer, payload: Buffer): Buffer {
	const size = Buffer.alloc(4);
	size.writeUInt32BE(payload.length);
	return Buffer.concat([header, size, payload]);
}

function transcribeVolcengine(wavPath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const connectId = randomUUID();

		const ws = new WebSocket(VOLC_STT_URL, {
			headers: {
				"X-Api-App-Key": config.VOLC_STT_APP_ID,
				"X-Api-Access-Key": config.VOLC_STT_ACCESS_TOKEN,
				"X-Api-Resource-Id": VOLC_RESOURCE_ID,
				"X-Api-Connect-Id": connectId,
			},
		});

		const timer = setTimeout(() => done(new Error("超时 (30s)")), 30_000);

		function done(err: Error | null, text?: string) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try { ws.close(); } catch {}
			if (err) reject(err);
			else resolve(text!);
		}

		ws.on("open", () => {
			// 1) full_client_request: JSON + gzip
			const configPayload = Buffer.from(JSON.stringify({
				user: { uid: "relay-bot" },
				audio: { format: "pcm", rate: 16000, bits: 16, channel: 1 },
				request: { model_name: "bigmodel", enable_itn: true, enable_punc: true, enable_ddc: true },
			}));
			const hdr = volcBuildHeader(0x1, 0x0, 0x1, 0x1);
			ws.send(volcBuildPacket(hdr, gzipSync(configPayload)));

			// 2) audio_only_request: 读 WAV 文件并分包发送 PCM 数据
			const wav = readFileSync(wavPath);
			let pcmOffset = 44;
			for (let i = 12; i + 8 < wav.length;) {
				if (wav.subarray(i, i + 4).toString("ascii") === "data") {
					pcmOffset = i + 8;
					break;
				}
				i += 8 + wav.readUInt32LE(i + 4);
			}
			const pcm = wav.subarray(pcmOffset);
			const CHUNK = 6400; // 200ms @ 16kHz 16-bit mono

			for (let off = 0; off < pcm.length; off += CHUNK) {
				const isLast = off + CHUNK >= pcm.length;
				const chunk = pcm.subarray(off, Math.min(off + CHUNK, pcm.length));
				// flags: 0x2 = last packet, 0x0 = normal; serial: raw(0), compress: gzip(1)
				const aHdr = volcBuildHeader(0x2, isLast ? 0x2 : 0x0, 0x0, 0x1);
				ws.send(volcBuildPacket(aHdr, gzipSync(chunk)));
			}
		});

		ws.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
			const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
			if (buf.length < 4) return;

			const msgType = (buf[1] >> 4) & 0xF;
			const flags = buf[1] & 0xF;
			const compress = buf[2] & 0xF;

			// 错误响应
			if (msgType === 0xF) {
				let msg = "服务端错误";
				if (buf.length >= 12) {
					const code = buf.readUInt32BE(4);
					const msgLen = buf.readUInt32BE(8);
					msg = `[${code}] ${buf.subarray(12, 12 + Math.min(msgLen, buf.length - 12)).toString("utf-8")}`;
				}
				done(new Error(msg));
				return;
			}

			// 等待最终识别结果（flags bit 1 = 最后一包响应）
			if (msgType === 0x9 && (flags & 0x2)) {
				let off = 4;
				if (flags & 0x1) off += 4; // 跳过 sequence number
				if (off + 4 > buf.length) return;
				const pSize = buf.readUInt32BE(off);
				off += 4;
				if (off + pSize > buf.length) return;

				let payload = buf.subarray(off, off + pSize);
				if (compress === 1) {
					try { payload = gunzipSync(payload); } catch { done(new Error("解压响应失败")); return; }
				}
				try {
					const json = JSON.parse(payload.toString("utf-8"));
					const text = json?.result?.text?.trim();
					if (text) done(null, text);
					else done(new Error("识别结果为空"));
				} catch {
					done(new Error("解析响应 JSON 失败"));
				}
			}
		});

		ws.on("error", (err: Error) => done(new Error(`WebSocket: ${err.message}`)));
		ws.on("close", () => { if (!settled) done(new Error("连接意外断开")); });
	});
}

function transcribeLocal(wavPath: string): string | null {
	if (!existsSync(WHISPER_MODEL)) return null;
	try {
		const result = execFileSync(
			WHISPER_BIN,
			["--model", WHISPER_MODEL, "--language", "zh", "--no-timestamps", wavPath],
			{ timeout: 120_000, encoding: "utf-8", stdio: "pipe" },
		);
		const transcript = result
			.split("\n")
			.filter((l: string) => !STT_DEBUG.test(l) && l.trim())
			.join(" ")
			.trim();
		return transcript || null;
	} catch (err) {
		console.error("[STT 本地失败]", err instanceof Error ? err.message : err);
		return null;
	}
}

async function transcribeAudio(audioPath: string): Promise<string | null> {
	let wavPath: string | undefined;
	try {
		wavPath = convertToWav(audioPath);

		// 火山引擎豆包大模型 → 本地 whisper 兜底
		if (config.VOLC_STT_APP_ID && config.VOLC_STT_ACCESS_TOKEN) {
			try {
				const text = await transcribeVolcengine(wavPath);
				console.log(`[STT 火山引擎] 成功 (${text.length} chars)`);
				return text;
			} catch (err) {
				console.warn("[STT 火山引擎失败，降级本地]", err instanceof Error ? err.message : err);
			}
		}

		const local = transcribeLocal(wavPath);
		if (local) console.log(`[STT 本地] 成功 (${local.length} chars)`);
		else console.warn("[STT] 所有引擎均不可用");
		return local;
	} catch (err) {
		console.error("[STT 转码失败]", err instanceof Error ? err.message : err);
		return null;
	} finally {
		if (wavPath) try { unlinkSync(wavPath); } catch {}
	}
}

// ── 消息解析 ─────────────────────────────────────
function parseContent(
	messageType: string,
	content: string,
): { text: string; imageKey?: string; fileKey?: string; fileName?: string } {
	try {
		const p = JSON.parse(content);
		switch (messageType) {
			case "text":
				return { text: p.text || "" };
			case "image":
				return { text: "", imageKey: p.image_key };
			case "audio":
				return { text: "", fileKey: p.file_key };
			case "file":
				return { text: "", fileKey: p.file_key, fileName: p.file_name };
			case "post": {
				const texts: string[] = [];
				for (const lang of Object.values(p) as Array<{
					title?: string;
					content?: Array<Array<{ tag: string; text?: string }>>;
				}>) {
					if (lang?.title) texts.push(lang.title);
					if (Array.isArray(lang?.content))
						for (const para of lang.content)
							for (const e of para) if (e.tag === "text" && e.text) texts.push(e.text);
				}
				return { text: texts.join(" ") };
			}
			default:
				return { text: `[不支持: ${messageType}]` };
		}
	} catch {
		return { text: content };
	}
}

// ── ANSI 清理 ────────────────────────────────────
function strip(s: string): string {
	return s
		.replace(/\x1b\][^\x07]*\x07/g, "")
		.replace(/\x1b\][^\x1b]*\x1b\\/g, "")
		.replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "")
		.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
		.replace(/\x1b[=>MNOZ78]/g, "")
		.replace(/\r/g, "")
		.trim();
}

// ── 项目路由 ─────────────────────────────────────
function route(text: string): { workspace: string; prompt: string; label: string } {
	const { projects, default_project } = projectsConfig;
	const m = text.match(/^(\S+?)[:\uff1a]\s*(.+)/s);
	if (m && projects[m[1].toLowerCase()]) {
		return {
			workspace: projects[m[1].toLowerCase()].path,
			prompt: m[2].trim(),
			label: m[1].toLowerCase(),
		};
	}
	return {
		workspace: projects[default_project]?.path || ROOT,
		prompt: text.trim(),
		label: default_project,
	};
}

// ── 模型自动降级 ─────────────────────────────────
// 每次请求都先试首选模型，失败再用 auto 重试
const BILLING_PATTERNS = [
	/unpaid invoice/i,
	/pay your invoice/i,
	/resume requests/i,
	/billing/i,
	/insufficient.*(balance|credit|fund|quota)/i,
	/exceeded.*limit/i,
	/payment.*required/i,
	/out of credits/i,
	/usage.*limit.*exceeded/i,
	/subscription.*expired/i,
	/plan.*expired/i,
	/402/,
	/费用不足/,
	/余额不足/,
	/额度/,
];

function isBillingError(text: string): boolean {
	return BILLING_PATTERNS.some((p) => p.test(text));
}

const childPids = new Set<number>();

process.on("SIGTERM", () => {
	for (const pid of childPids) {
		try { process.kill(pid, "SIGTERM"); } catch {}
	}
	process.exit(0);
});

// ── Agent 执行引擎（直接 spawn CLI + stream-json）──
const MAX_EXEC_TIMEOUT = 30 * 60 * 1000;
const STUCK_TIMEOUT = 60 * 1000;
const PROGRESS_INTERVAL = 6_000;

interface AgentProgress {
	elapsed: number;
	phase: "thinking" | "tool_call" | "responding";
	snippet: string;
}

function formatElapsed(seconds: number): string {
	if (seconds < 60) return `${seconds}秒`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (mins < 60) return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
	const hrs = Math.floor(mins / 60);
	return `${hrs}时${mins % 60}分`;
}

// 每个 workspace 保存 session_id，实现会话连续性
const sessionIds = new Map<string, string>();

function resetSession(workspace: string): void {
	if (sessionIds.has(workspace)) {
		sessionIds.delete(workspace);
		console.log(`[Session ${workspace}] 已重置`);
	}
}

// 同一 workspace 的消息必须串行执行
const sessionLocks = new Map<string, Promise<void>>();
async function withSessionLock<T>(workspace: string, fn: () => Promise<T>): Promise<T> {
	const prev = sessionLocks.get(workspace) || Promise.resolve();
	let release!: () => void;
	const next = new Promise<void>((r) => { release = r; });
	sessionLocks.set(workspace, next);
	await prev;
	try {
		return await fn();
	} finally {
		release();
	}
}

// 解析一行 stream-json 输出
interface StreamEvent {
	type: string;
	subtype?: string;
	session_id?: string;
	text?: string;
	result?: string;
	error?: string;
	message?: { role: string; content: Array<{ type: string; text?: string }> };
	tool_name?: string;
	tool_call_id?: string;
}

function tryParseJson(line: string): StreamEvent | null {
	const trimmed = line.trim();
	if (!trimmed || !trimmed.startsWith("{")) return null;
	try { return JSON.parse(trimmed); } catch { return null; }
}

// 核心：spawn agent CLI，解析 stream-json，返回结果
function execAgent(
	workspace: string,
	model: string,
	prompt: string,
	opts?: {
		sessionId?: string;
		onProgress?: (p: AgentProgress) => void;
	},
): Promise<{ result: string; sessionId?: string }> {
	return new Promise((res, reject) => {
		const args = [
			"-p", "--force", "--trust", "--approve-mcps",
			"--workspace", workspace,
			"--model", model,
			"--output-format", "stream-json",
			"--stream-partial-output",
		];

		if (opts?.sessionId) {
			args.push("--resume", opts.sessionId);
		}
		args.push("--", prompt);

		const child = spawn(AGENT_BIN, args, {
			env: { ...process.env, CURSOR_API_KEY: config.CURSOR_API_KEY },
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (child.pid) childPids.add(child.pid);

		let stderr = "";
		let resultText = "";
		let sessionId: string | undefined;
		let phase: AgentProgress["phase"] = "thinking";
		let thinkingBuf = "";
		let assistantBuf = "";
		let done = false;
		const startTime = Date.now();
		let lastOutputTime = Date.now();
		let lastProgressTime = 0;
		let lineBuf = "";

		function cleanup() {
			done = true;
			clearInterval(timer);
			if (child.pid) childPids.delete(child.pid);
		}

		const timer = setInterval(() => {
			if (done) return;
			const now = Date.now();
			const elapsed = now - startTime;
			if (elapsed > MAX_EXEC_TIMEOUT) {
				cleanup();
				child.kill("SIGTERM");
				reject(new Error(`[TIMEOUT] 执行超过 ${formatElapsed(Math.round(MAX_EXEC_TIMEOUT / 1000))}`));
				return;
			}
			if (now - lastOutputTime > STUCK_TIMEOUT) {
				cleanup();
				child.kill("SIGTERM");
				reject(new Error(`[IDLE] 超过 ${formatElapsed(Math.round(STUCK_TIMEOUT / 1000))} 无响应`));
				return;
			}
			if (opts?.onProgress && now - lastProgressTime >= PROGRESS_INTERVAL) {
				lastProgressTime = now;
				const snippet = phase === "thinking"
					? thinkingBuf.slice(-200)
					: assistantBuf.slice(-300);
				if (snippet) {
					opts.onProgress({
						elapsed: Math.round(elapsed / 1000),
						phase,
						snippet,
					});
				}
			}
		}, 1000);

		function processLine(line: string) {
			const ev = tryParseJson(line);
			if (!ev) return;

			if (ev.session_id && !sessionId) sessionId = ev.session_id;

			switch (ev.type) {
				case "thinking":
					phase = "thinking";
					if (ev.text) thinkingBuf += ev.text;
					break;
				case "assistant":
					phase = "responding";
					if (ev.message?.content) {
						for (const c of ev.message.content) {
							if (c.type === "text" && c.text) assistantBuf += c.text;
						}
					}
					break;
				case "tool_call":
					phase = "tool_call";
					break;
				case "result":
					if (ev.result != null) resultText = ev.result;
					if (ev.subtype === "error" && ev.error) {
						resultText = ev.error;
					}
					break;
			}
		}

		child.stdout!.on("data", (chunk: Buffer) => {
			lastOutputTime = Date.now();
			lineBuf += chunk.toString();
			const lines = lineBuf.split("\n");
			lineBuf = lines.pop()!;
			for (const line of lines) processLine(line);
		});

		child.stderr!.on("data", (chunk: Buffer) => {
			lastOutputTime = Date.now();
			stderr += chunk.toString();
		});

		child.on("close", (code) => {
			if (done) return;
			cleanup();
			// 处理 lineBuf 中残留的最后一行
			if (lineBuf.trim()) processLine(lineBuf);

			const output = resultText || strip(assistantBuf) || strip(stderr) || "(无输出)";

			if (code !== 0 && code !== null && !resultText) {
				reject(new Error(strip(stderr) || output));
				return;
			}
			if (isBillingError(output) || isBillingError(stderr)) {
				reject(new Error(output));
				return;
			}
			res({ result: output, sessionId });
		});

		child.on("error", (err) => {
			if (!done) { cleanup(); reject(err); }
		});
	});
}

// ── 工作区活跃追踪（用于判断是否需要排队）──────
const busyWorkspaces = new Set<string>();

// ── 发送消息（会话优先，欠费降级 auto）──────────
async function runAgent(
	workspace: string,
	prompt: string,
	opts?: {
		onProgress?: (p: AgentProgress) => void;
		onStart?: () => void;
	},
): Promise<{ result: string; quotaWarning?: string }> {
	const primaryModel = config.CURSOR_MODEL;

	return withSessionLock(workspace, async () => {
		busyWorkspaces.add(workspace);
		opts?.onStart?.();
		try {
			const existingSessionId = sessionIds.get(workspace);

			try {
				const { result, sessionId } = await execAgent(workspace, primaryModel, prompt, {
					sessionId: existingSessionId,
					onProgress: opts?.onProgress,
				});
				if (sessionId) sessionIds.set(workspace, sessionId);
				return { result };
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));

				if (existingSessionId && !isBillingError(e.message)) {
					console.warn(`[重试] 会话可能过期，重新创建: ${e.message.slice(0, 100)}`);
					sessionIds.delete(workspace);
					try {
						const { result, sessionId } = await execAgent(workspace, primaryModel, prompt, {
							onProgress: opts?.onProgress,
						});
						if (sessionId) sessionIds.set(workspace, sessionId);
						return { result };
					} catch (retryErr) {
						const re = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
						if (!isBillingError(re.message)) throw re;
					}
				}

				if (isBillingError(e.message)) {
					console.error(`[降级] ${primaryModel} 欠费: ${e.message.slice(0, 200)}`);
					sessionIds.delete(workspace);
					try {
						const { result } = await execAgent(workspace, "auto", prompt, {
							onProgress: opts?.onProgress,
						});
						return {
							result,
							quotaWarning: `⚠️ **模型降级通知**\n\n${primaryModel} 欠费，本次已用 auto 完成。\n\n> ${e.message.slice(0, 100)}`,
						};
					} catch {
						throw e;
					}
				}

				sessionIds.delete(workspace);
				throw e;
			}
		} finally {
			busyWorkspaces.delete(workspace);
		}
	});
}

// ── 去重 + 并发控制 + 排队 ───────────────────────
const seen = new Map<string, number>();
function isDup(id: string): boolean {
	const now = Date.now();
	for (const [k, t] of seen) if (now - t > 60_000) seen.delete(k);
	if (seen.has(id)) return true;
	seen.set(id, now);
	return false;
}
let active = 0;
const MAX = 2;
const waitQueue: Array<() => void> = [];

function releaseSlot() {
	active--;
	if (waitQueue.length > 0) {
		waitQueue.shift()!();
	}
}

// ── 消息处理 ─────────────────────────────────────
async function handle(params: {
	text: string;
	messageId: string;
	chatId: string;
	chatType: string;
	messageType: string;
	content: string;
}) {
	const { messageId, chatId, chatType, messageType, content } = params;
	let { text } = params;
	console.log(`[${new Date().toISOString()}] [${messageType}] ${text.slice(0, 80)}`);

	// 全局并发控制
	let cardId: string | undefined;
	if (active >= MAX) {
		const pos = waitQueue.length + 1;
		console.log(`[排队] 第${pos}位 (当前 ${active} 个运行中)`);
		cardId = await replyCard(messageId, `⏳ 排队中（第${pos}位，前面 ${active} 个任务）`, {
			title: "排队中",
			color: "grey",
		});
		await new Promise<void>((resolve) => waitQueue.push(resolve));
	}

	active++;

	try {
		return await handleInner(text, messageId, chatId, chatType, messageType, content, cardId);
	} finally {
		releaseSlot();
	}
}

async function handleInner(
	text: string,
	messageId: string,
	chatId: string,
	chatType: string,
	messageType: string,
	content: string,
	cardId?: string,
): Promise<void> {
	const isGroup = chatType === "group";
	// 处理媒体附件
	const parsed = parseContent(messageType, content);
	try {
		if (parsed.imageKey) {
			const path = await downloadMedia(messageId, parsed.imageKey, "image", ".png");
			text = text
				? `${text}\n\n[附件图片: ${path}]`
				: `用户发了一张图片，已保存到 ${path}，请查看并回复。`;
		}
		if (parsed.fileKey && messageType === "audio") {
			if (!cardId) {
				cardId = await replyCard(messageId, "🎙️ 正在识别语音...", { title: "语音识别中", color: "wathet" });
			} else {
				await updateCard(cardId, "🎙️ 正在识别语音...", { title: "语音识别中", color: "wathet" });
			}
			const audioPath = await downloadMedia(messageId, parsed.fileKey, "file", ".ogg");
			const transcript = await transcribeAudio(audioPath);
			try { unlinkSync(audioPath); } catch {}
			if (transcript) {
				text = transcript;
				console.log(`[语音] 转文字成功: ${transcript.slice(0, 80)}`);
			} else {
				text = `用户发了一条语音消息，音频文件在 ${audioPath}，请处理并回复。`;
				console.warn("[语音] 转文字失败，传原始文件路径");
			}
		}
		if (parsed.fileKey && messageType === "file") {
			const dotIdx = parsed.fileName?.lastIndexOf(".");
			const ext = dotIdx != null && dotIdx > 0 ? parsed.fileName!.slice(dotIdx) : "";
			const path = await downloadMedia(messageId, parsed.fileKey, "file", ext);
			text = text
				? `${text}\n\n[附件: ${path}]`
				: `用户发了文件 ${parsed.fileName || ""}，已保存到 ${path}`;
		}
	} catch (e) {
		console.error("[下载失败]", e);
		if (!text) {
			if (cardId) await updateCard(cardId, "❌ 媒体下载失败，请重新发送", { color: "red" });
			else await replyCard(messageId, "❌ 媒体下载失败，请重新发送");
			return;
		}
	}

	if (!text) return;

	// /apikey、/密钥、/换key → 更换 Cursor API Key
	if (/^\/?(?:apikey|api\s*key|密钥|换key|更换密钥)\s*$/i.test(text.trim())) {
		const keyPreview = config.CURSOR_API_KEY ? `\`...${config.CURSOR_API_KEY.slice(-8)}\`` : "**未设置**";
		await replyCard(messageId, `当前 Key：${keyPreview}\n\n更换方式：\`/密钥 key_xxx...\` 或 \`/apikey key_xxx...\`\n\n[生成新 Key →](https://cursor.com/dashboard)`, { title: "API Key", color: "blue" });
		return;
	}
	const apikeyMatch = text.match(/^\/?(?:api\s*key|密钥|换key|更换密钥)[\s:：=]*(.+)/i);
	if (apikeyMatch) {
		if (isGroup) {
			await replyCard(messageId, "⚠️ **安全提醒：请勿在群聊中发送 API Key！**\n\n请在与机器人的 **私聊** 中发送 `/apikey` 指令。", { title: "安全提醒", color: "red" });
			return;
		}
		const rawKey = apikeyMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "");
		if (!rawKey || rawKey.length < 20) {
			await replyCard(messageId, "❌ Key 格式不对，太短了。请发送完整的 Cursor API Key。\n\n支持格式：\n- `/apikey key_xxxx...`\n- `/密钥 key_xxxx...`\n- `/换key key_xxxx...`", { title: "格式错误", color: "red" });
			return;
		}
		try {
			const envContent = readFileSync(ENV_PATH, "utf-8");
			const updated = envContent.replace(/^CURSOR_API_KEY=.*$/m, `CURSOR_API_KEY=${rawKey}`);
			writeFileSync(ENV_PATH, updated);
			await replyCard(messageId, `**API Key 已更换**\n\n新 Key: \`...${rawKey.slice(-8)}\`\n\n已写入 .env 并自动生效。`, { title: "Key 已更新", color: "green" });
			console.log(`[指令] API Key 已通过飞书更换 (...${rawKey.slice(-8)})`);
		} catch (err) {
			await replyCard(messageId, `❌ 写入失败: ${err instanceof Error ? err.message : err}`, { color: "red" });
		}
		return;
	}

	// /help → 显示所有可用指令
	if (/^\/(help|帮助|指令)\s*$/i.test(text.trim())) {
		const helpText = [
			"**可用指令：**",
			"",
			"| 指令 | 中文别名 | 说明 |",
			"|------|----------|------|",
			"| `/help` | `/帮助` `/指令` | 显示本帮助 |",
			"| `/status` | `/状态` | 查看服务状态 |",
			"| `/new` | `/新对话` `/新会话` | 重置当前工作区会话 |",
			"| `/model 名称` | `/模型 名称` `/切换模型 名称` | 切换模型 |",
			"| `/apikey key` | `/密钥 key` `/换key key` | 更换 API Key（仅私聊） |",
			"",
			"**项目路由：**",
			"发送 `项目名:消息` 指定工作区，如 `openclaw:帮我看看这个bug`",
			"",
			`当前可用项目：${Object.keys(projectsConfig.projects).map((k) => `\`${k}\``).join("、")}`,
			`默认项目：\`${projectsConfig.default_project}\``,
		].join("\n");
		await replyCard(messageId, helpText, { title: "使用帮助", color: "blue" });
		return;
	}

	// /status → 服务状态一览
	if (/^\/(status|状态)\s*$/i.test(text.trim())) {
		const keyPreview = config.CURSOR_API_KEY ? `\`...${config.CURSOR_API_KEY.slice(-8)}\`` : "**未设置**";
		const sttStatus = config.VOLC_STT_APP_ID ? "火山引擎豆包大模型" : (existsSync(WHISPER_MODEL) ? "本地 whisper" : "不可用");
		const projects = Object.entries(projectsConfig.projects).map(([k, v]) => `  \`${k}\` → ${v.path}`).join("\n");
		const sessions = [...sessionIds.entries()].map(([ws, sid]) => {
			const name = Object.entries(projectsConfig.projects).find(([, v]) => v.path === ws)?.[0] || ws;
			return `  \`${name}\` → ${sid.slice(0, 12)}...`;
		}).join("\n") || "  (无活跃会话)";
		const statusText = [
			`**模型：** ${config.CURSOR_MODEL}`,
			`**Key：** ${keyPreview}`,
			`**STT：** ${sttStatus}`,
			`**并发：** ${active}/${MAX} 运行中，${waitQueue.length} 排队`,
			"",
			"**项目路由：**",
			projects,
			"",
			"**活跃会话：**",
			sessions,
		].join("\n");
		await replyCard(messageId, statusText, { title: "服务状态", color: "blue" });
		return;
	}

	// /model、/模型、/切换模型 → 切换模型
	const modelMatch = text.match(/^\/(model|模型|切换模型)[\s:：=]*(.+)/i);
	if (/^\/(model|模型|切换模型)\s*$/i.test(text.trim())) {
		await replyCard(messageId, `当前模型：**${config.CURSOR_MODEL}**\n\n切换示例：\`/模型 sonnet-4\` 或 \`/model sonnet-4\``, { title: "当前模型", color: "blue" });
		return;
	}
	if (modelMatch) {
		const newModel = modelMatch[2].trim();
		const envContent = readFileSync(ENV_PATH, "utf-8");
		const updated = envContent.match(/^CURSOR_MODEL=/m)
			? envContent.replace(/^CURSOR_MODEL=.*$/m, `CURSOR_MODEL=${newModel}`)
			: `${envContent.trimEnd()}\nCURSOR_MODEL=${newModel}\n`;
		writeFileSync(ENV_PATH, updated);
		await replyCard(messageId, `**模型已切换**\n\n${config.CURSOR_MODEL} → **${newModel}**\n\n已写入 .env，2 秒内自动生效。`, { title: "模型已切换", color: "green" });
		console.log(`[指令] 模型切换: ${config.CURSOR_MODEL} → ${newModel}`);
		return;
	}

	// /new、/新对话、/新会话 → 重置会话
	const { workspace, prompt, label } = route(text);
	if (/^\/(new|新对话|新会话)\s*$/i.test(prompt.trim())) {
		resetSession(workspace);
		const msg = `**[${label}]** 新会话已开始，下一条消息将创建全新对话。`;
		if (cardId) await updateCard(cardId, msg, { title: "新会话", color: "blue" });
		else await replyCard(messageId, msg, { title: "新会话", color: "blue" });
		return;
	}

	// 未知 / 指令 → 友好提示
	if (text.startsWith("/")) {
		const cmd = text.split(/[\s:：]/)[0];
		await replyCard(messageId, `未知指令 \`${cmd}\`\n\n发送 \`/help\` 查看所有可用指令。`, { title: "未知指令", color: "orange" });
		return;
	}

	const model = config.CURSOR_MODEL;

	// 创建或复用卡片：全局排队卡片 → 同工作区排队 → 处理中
	const needsWorkspaceQueue = !cardId && busyWorkspaces.has(workspace);
	if (!cardId) {
		const status = needsWorkspaceQueue
			? `⏳ 排队中（同工作区有任务进行中）\n\n> ${prompt.slice(0, 120)}`
			: `⏳ 正在执行...\n\n> ${prompt.slice(0, 120)}`;
		cardId = await replyCard(messageId, status, {
			title: needsWorkspaceQueue ? "排队中" : "处理中",
			color: needsWorkspaceQueue ? "grey" : "wathet",
		});
	} else {
		// 从全局排队卡片复用，看是否还需要等同工作区锁
		const status = busyWorkspaces.has(workspace)
			? `⏳ 排队中（同工作区有任务进行中）\n\n> ${prompt.slice(0, 120)}`
			: `⏳ 正在执行...\n\n> ${prompt.slice(0, 120)}`;
		await updateCard(cardId, status, {
			title: busyWorkspaces.has(workspace) ? "排队中" : "处理中",
			color: busyWorkspaces.has(workspace) ? "grey" : "wathet",
		});
	}
	console.log(`[Agent] 调用 Cursor CLI workspace=${workspace} model=${model} card=${cardId}`);
	const taskStart = Date.now();

	// runAgent 获取 session lock 后回调 onStart，更新卡片为"处理中"
	const onStart = cardId
		? () => {
				updateCard(cardId!, `⏳ 正在执行...\n\n> ${prompt.slice(0, 120)}`, {
					title: "处理中",
					color: "wathet",
				}).catch(() => {});
			}
		: undefined;

	const onProgress = cardId
		? (p: AgentProgress) => {
				const time = formatElapsed(p.elapsed);
				const phaseLabel = p.phase === "thinking" ? "🤔 思考中" : p.phase === "tool_call" ? "🔧 执行工具" : "💬 回复中";
				const snippet = p.snippet.split("\n").filter((l) => l.trim()).slice(-4).join("\n");
				updateCard(
					cardId!,
					`\`\`\`\n${snippet.slice(0, 300) || "..."}\n\`\`\``,
					{ title: `${phaseLabel} · ${time}`, color: "wathet" },
				).catch(() => {});
			}
		: undefined;

	try {
		const { result, quotaWarning } = await runAgent(workspace, prompt, { onProgress, onStart });
		const usedModel = quotaWarning ? "auto" : model;
		const elapsed = formatElapsed(Math.round((Date.now() - taskStart) / 1000));
		console.log(`[${new Date().toISOString()}] 完成 [${label}] model=${usedModel} elapsed=${elapsed} (${result.length} chars)`);

		const fullResult = quotaWarning ? `${quotaWarning}\n\n---\n\n${result}` : result;
		const doneTitle = quotaWarning ? `完成 · ${elapsed}` : `完成 · ${elapsed}`;

		if (cardId && fullResult.length <= CARD_MAX) {
			await updateCard(cardId, fullResult, { title: doneTitle, color: quotaWarning ? "orange" : "green" });
		} else {
			if (cardId) {
				await updateCard(cardId, quotaWarning || "执行完成，结果见下方", {
					title: doneTitle,
					color: quotaWarning ? "orange" : "green",
				});
			}
			await replyLongMessage(messageId, chatId, result, { title: doneTitle, color: "green" });
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[${new Date().toISOString()}] 失败 [${label}]: ${msg}`);
		if (err instanceof Error && err.stack) console.error(`[Stack] ${err.stack}`);

		const isAuthError = /authentication required|not authenticated|unauthorized|api.key/i.test(msg);
		const body = isAuthError
			? `**API Key 失效，请更换：**\n\n1. 打开 [Cursor Dashboard](https://cursor.com/dashboard) → Integrations → User API Keys\n2. 点 **Create API Key** 生成新 Key\n3. 在飞书发送：\`/apikey 你的新Key\`\n\n\`\`\`\n${msg.slice(0, 500)}\n\`\`\``
			: `**执行失败**\n\n\`\`\`\n${msg.slice(0, 2000)}\n\`\`\``;
		const title = isAuthError ? "API Key 失效" : "执行失败";

		if (cardId) {
			await updateCard(cardId, body, { title, color: "red" });
		} else {
			await replyCard(messageId, body, { title, color: "red" });
		}
	}
}

// ── 飞书长连接 ───────────────────────────────────
const dispatcher = new Lark.EventDispatcher({});
const TYPES = new Set(["text", "image", "audio", "file", "post"]);

dispatcher.register({
	"im.message.receive_v1": async (data) => {
		console.log("[事件] 收到 im.message.receive_v1");
		try {
			const ev = data as Record<string, unknown>;
			const msg = ev.message as Record<string, unknown>;
			if (!msg) {
				console.error("[事件] msg 为空");
				return;
			}
			const messageType = msg.message_type as string;
			const messageId = msg.message_id as string;
			const chatId = msg.chat_id as string;
			const chatType = (msg.chat_type as string) || "p2p";
			const content = msg.content as string;

			if (isDup(messageId)) return;
			if (!TYPES.has(messageType)) {
				await replyCard(messageId, `暂不支持: ${messageType}`);
				return;
			}

			const { text: parsedText, imageKey, fileKey } = parseContent(messageType, content);
			console.log(`[解析] type=${messageType} chat=${chatType} text="${parsedText.slice(0, 60)}" img=${imageKey ?? ""} file=${fileKey ?? ""}`);
			handle({ text: parsedText.trim(), messageId, chatId, chatType, messageType, content }).catch(console.error);
		} catch (e) {
			console.error("[事件异常]", e);
		}
	},
});

const ws = new Lark.WSClient({
	appId: config.FEISHU_APP_ID,
	appSecret: config.FEISHU_APP_SECRET,
	domain: Lark.Domain.Feishu,
	loggerLevel: Lark.LoggerLevel.info,
});

// ── 启动 ─────────────────────────────────────────
const list = Object.entries(projectsConfig.projects)
	.map(([k, v]) => `  ${k} → ${v.path}`)
	.join("\n");
const sttEngine = config.VOLC_STT_APP_ID ? "火山引擎豆包大模型" : "本地 whisper";
console.log(`
┌──────────────────────────────────────────────────┐
│  飞书 → Cursor Agent 中继服务 v3                 │
├──────────────────────────────────────────────────┤
│  模型: ${config.CURSOR_MODEL}
│  Key:  ...${config.CURSOR_API_KEY.slice(-8)}
│  连接: 飞书 WebSocket 长连接
│  收件: ${INBOX_DIR}
│  语音: ${sttEngine}
│
│  回复: 互动卡片 + 消息更新（无需 CardKit 权限）
│  直连: 飞书消息 → Cursor CLI（stream-json + --resume）
│
│  项目路由:
${list}
│
│  热更换: 编辑 .env 即可
└──────────────────────────────────────────────────┘
`);

ws.start({ eventDispatcher: dispatcher });
console.log("飞书长连接已启动，等待消息...");
