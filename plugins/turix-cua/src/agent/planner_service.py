import asyncio
from dataclasses import dataclass
import json
import logging
import os
import re
from typing import Any, List, Optional

from pydantic import BaseModel

from dotenv import load_dotenv
from langchain_core.messages import BaseMessage

from src.agent.message_manager.service import MessageManager
from src.agent.prompts import PlannerPrompt, PlannerPreplanPrompt, PlannerPlanMessageBuilder
from src.controller.service import Controller
from src.utils.skills import SkillMetadata, load_skill_contents, format_skill_context

try:
    # Preferred package name (renamed from duckduckgo_search)
    from ddgs import DDGS  # type: ignore
    from ddgs.exceptions import DDGSException  # type: ignore
except ImportError:
    try:
        from duckduckgo_search import DDGS  # type: ignore
        from duckduckgo_search.exceptions import DuckDuckGoSearchException as DDGSException  # type: ignore
    except ImportError:
        DDGS = None
        DDGSException = Exception  # type: ignore

load_dotenv()
logger = logging.getLogger(__name__)
# Silence noisy logs from ddgs/primp to keep planner output clean.
logging.getLogger("primp").setLevel(logging.WARNING)
logging.getLogger("primp").propagate = False
logging.getLogger("ddgs").setLevel(logging.WARNING)


@dataclass(frozen=True)
class PreplanDecision:
    use_search: bool
    queries: List[str]
    selected_skills: List[str]
    raw_text: str = ""


class Planner:
    def __init__(self,
                 planner_llm,
                 task: str,
                 max_input_tokens: int = 32000,
                 search_llm=None,
                 use_search: bool = True,
                 skill_catalog: str = "",
                 save_planner_conversation_path: Optional[str] = None,
                 save_planner_conversation_path_encoding: Optional[str] = "utf-8",
                 use_skills: bool = False,
                 available_skills: Optional[List[SkillMetadata]] = None,
                 skills_max_chars: int = 4000,
                 preplan_llm=None,
                 ):
        self.planner_llm = planner_llm
        self.controller = Controller()
        self.task = task
        self.max_input_tokens = max_input_tokens
        self.plan_list = []
        self._search_context: Optional[str] = None
        self.preplan_llm = preplan_llm or search_llm
        self.use_search = use_search
        self.skill_catalog = skill_catalog
        self.use_skills = use_skills
        self.available_skills = list(available_skills) if available_skills else []
        self.skills_max_chars = max(0, skills_max_chars or 0)
        self._preplan_decision: Optional[PreplanDecision] = None
        self._skill_context: Optional[str] = None
        self.save_planner_conversation_path = save_planner_conversation_path
        self.save_planner_conversation_path_encoding = save_planner_conversation_path_encoding or "utf-8"

        self.message_manager = MessageManager(
            llm=self.planner_llm,
            task=self.task,
            action_descriptions=self.controller.registry.get_prompt_description(),
            system_prompt_class=PlannerPrompt,
            max_input_tokens=self.max_input_tokens,
        )

    def _coerce_json_text(self, text: str) -> str:
        cleaned = (text or "").strip()
        if not cleaned:
            return cleaned
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            return cleaned
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return cleaned[start:end + 1]
        return cleaned

    def _parse_json_payload(self, text: str) -> tuple[Optional[dict], str]:
        cleaned = self._coerce_json_text(text)
        if not cleaned:
            return None, text
        try:
            payload = json.loads(cleaned)
        except Exception:
            return None, text
        if isinstance(payload, dict) and "content" in payload and isinstance(payload["content"], str):
            inner_text = payload["content"]
            inner_cleaned = self._coerce_json_text(inner_text)
            try:
                inner_payload = json.loads(inner_cleaned)
            except Exception:
                return payload, cleaned
            if isinstance(inner_payload, dict):
                return inner_payload, inner_cleaned or inner_text
        if isinstance(payload, dict):
            return payload, cleaned
        return None, cleaned

    def _extract_planner_payload(self, response: Any) -> "PlannerResult":
        if isinstance(response, BaseMessage):
            raw_content = getattr(response, "content", "")
            if isinstance(raw_content, str):
                raw_text = raw_content
            else:
                try:
                    raw_text = json.dumps(raw_content, ensure_ascii=False)
                except Exception:
                    raw_text = str(raw_content)
            payload, normalized_text = self._parse_json_payload(raw_text)
            return PlannerResult(raw_text=normalized_text or raw_text, payload=payload)

        if isinstance(response, BaseModel):
            payload = response.model_dump(exclude_none=True)
            raw_text = json.dumps(payload, ensure_ascii=False)
            return PlannerResult(raw_text=raw_text, payload=payload)

        raw_content = getattr(response, "content", "")
        if isinstance(raw_content, str):
            raw_text = raw_content
        else:
            try:
                raw_text = json.dumps(raw_content, ensure_ascii=False)
            except Exception:
                raw_text = str(raw_content)

        payload, normalized_text = self._parse_json_payload(raw_text)
        return PlannerResult(raw_text=normalized_text or raw_text, payload=payload)

    def _save_planner_conversation(
        self,
        messages: list[BaseMessage],
        response_text: str,
        label: str,
    ) -> None:
        if not self.save_planner_conversation_path:
            return
        file_name = f"{self.save_planner_conversation_path}_planner_{label}.txt"
        os.makedirs(os.path.dirname(file_name), exist_ok=True) if os.path.dirname(file_name) else None
        with open(file_name, "w", encoding=self.save_planner_conversation_path_encoding) as f:
            for message in messages:
                f.write(f"\n{message.__class__.__name__}\n{'-'*40}\n")
                content = message.content
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict):
                            if item.get("type") == "text":
                                txt = item.get("content") or item.get("text", "")
                                f.write(f"[Text Content]\n{txt.strip()}\n\n")
                            elif item.get("type") == "image_url":
                                image_url = item["image_url"]["url"]
                                f.write(f"[Image URL]\n{image_url[:100]}...\n\n")
                else:
                    f.write(f"{str(content)}\n\n")
                f.write("\n" + "=" * 60 + "\n")
            f.write("RESPONSE\n")
            f.write(str(response_text) + "\n")
            f.write("\n" + "=" * 60 + "\n")

    async def _decide_search_queries(self) -> List[str]:
        """
        Use the cached preplan decision to determine search queries.
        """
        if not self.use_search:
            return []
        decision = await self._ensure_preplan_decision()
        if not decision.use_search:
            return []
        return decision.queries

    def _parse_query_lines(self, text: str) -> List[str]:
        lines = []
        for raw in (text or "").splitlines():
            cleaned = re.sub(r"^[\\s\\-\\*\\d\\)\\.]+", "", raw).strip().strip('"')
            if cleaned:
                lines.append(cleaned)
        if not lines:
            return []
        seen = set()
        deduped = []
        for q in lines:
            if q not in seen:
                deduped.append(q)
                seen.add(q)
        return deduped

    def _normalize_skill_name(self, name: str) -> str:
        return re.sub(r"\s+", "-", name.strip().lower())

    def _dedupe_list(self, items: List[str]) -> List[str]:
        seen = set()
        deduped = []
        for item in items:
            if item not in seen:
                deduped.append(item)
                seen.add(item)
        return deduped

    def _safe_json_loads(self, text: str) -> Optional[Any]:
        cleaned = self._coerce_json_text(text)
        if not cleaned:
            return None
        try:
            return json.loads(cleaned)
        except Exception:
            return None

    def _canonicalize_selected_skills(self, names: List[str]) -> List[str]:
        if not names or not self.available_skills:
            return []
        lookup = {self._normalize_skill_name(skill.name): skill.name for skill in self.available_skills}
        selected = []
        for raw in names:
            if not isinstance(raw, str):
                continue
            normalized = self._normalize_skill_name(raw)
            canonical = lookup.get(normalized)
            if canonical and canonical not in selected:
                selected.append(canonical)
        return selected

    def _parse_preplan_response(self, text: str) -> PreplanDecision:
        data = self._safe_json_loads(text)
        raw_use_search = None
        raw_queries: List[str] = []
        raw_selected: List[str] = []

        if isinstance(data, dict):
            raw_use_search = data.get("use_search")
            queries_value = data.get("queries") or data.get("search_queries") or []
            if isinstance(queries_value, str):
                raw_queries = [queries_value]
            elif isinstance(queries_value, list):
                raw_queries = [q for q in queries_value if isinstance(q, str)]

            skills_value = data.get("selected_skills") or data.get("skills") or []
            if isinstance(skills_value, str):
                raw_selected = [skills_value]
            elif isinstance(skills_value, list):
                raw_selected = [s for s in skills_value if isinstance(s, str)]
        elif isinstance(data, list):
            raw_queries = [q for q in data if isinstance(q, str)]
        else:
            raw_queries = self._parse_query_lines(text)

        queries = [q.strip() for q in raw_queries if isinstance(q, str) and q.strip()]
        queries = self._dedupe_list(queries)

        use_search = False
        if self.use_search:
            if isinstance(raw_use_search, bool):
                use_search = raw_use_search
            elif queries:
                use_search = True
        if not queries:
            use_search = False
        if not use_search:
            queries = []

        selected_skills: List[str] = []
        if self.use_skills and raw_selected:
            cleaned = [s.strip() for s in raw_selected if isinstance(s, str) and s.strip()]
            selected_skills = self._canonicalize_selected_skills(cleaned)

        return PreplanDecision(
            use_search=use_search,
            queries=queries,
            selected_skills=selected_skills,
            raw_text=text or "",
        )

    async def _ensure_preplan_decision(self) -> PreplanDecision:
        if self._preplan_decision is not None:
            return self._preplan_decision

        default = PreplanDecision(use_search=False, queries=[], selected_skills=[], raw_text="")
        if not (self.use_search or self.use_skills):
            self._preplan_decision = default
            return self._preplan_decision

        if not self.preplan_llm:
            logger.info("Planner preplan LLM unavailable; skipping search/skill preselection.")
            self._preplan_decision = default
            return self._preplan_decision

        try:
            prompt_builder = PlannerPreplanPrompt(
                task=self.task,
                use_search=self.use_search,
                use_skills=self.use_skills,
                skill_catalog=self.skill_catalog,
            )
            messages = prompt_builder.get_messages()
            resp = await self.preplan_llm.ainvoke(messages)
            text = getattr(resp, "content", "") or ""
            decision = self._parse_preplan_response(text if isinstance(text, str) else str(text))
            self._save_planner_conversation(messages, text if isinstance(text, str) else str(text), "preplan")
        except Exception as exc:
            logger.debug("Preplan decision failed; skipping search/skills: %s", exc, exc_info=True)
            decision = default

        if decision.use_search and decision.queries:
            logger.info("Planner preplan queries: %s", decision.queries)
        elif self.use_search:
            logger.info("Planner preplan: search disabled or no queries.")

        if self.use_skills:
            if decision.selected_skills:
                logger.info("Planner preplan selected skills: %s", ", ".join(decision.selected_skills))
            else:
                logger.info("Planner preplan selected no skills.")

        self._preplan_decision = decision
        return decision

    def _build_query_variants(self, query: str) -> List[tuple[str, Optional[str]]]:
        """
        Build a small set of query/backend combinations to increase the chance of results.
        """
        if not query:
            return []

        clean_query = query.strip()
        variants: List[tuple[str, Optional[str]]] = []

        # Primary attempt: full query with DuckDuckGo backend
        variants.append((clean_query, "duckduckgo"))

        # If the query is very long, try a truncated version (DuckDuckGo)
        if len(clean_query) > 256:
            variants.append((clean_query[:256], "duckduckgo"))

        # Fallbacks: let ddgs auto-select backend with original and truncated queries
        variants.append((clean_query, "auto"))
        if len(clean_query) > 256:
            variants.append((clean_query[:256], "auto"))

        return variants

    async def _fetch_search_results(self, query: str, max_results: int = 8) -> List[dict]:
        """
        Fetch DuckDuckGo search results in a background thread to avoid blocking the event loop.
        """
        if not query:
            return []
        if DDGS is None:
            logger.debug("duckduckgo_search not installed; skipping planner search context.")
            return []

        loop = asyncio.get_running_loop()

        def _search():
            try:
                with DDGS() as ddgs:
                    for q, backend in self._build_query_variants(query):
                        try:
                            results = list(ddgs.text(q, backend=backend, max_results=max_results))
                            if results:
                                logger.info("Planner search success (backend=%s, query=%r): %d results", backend, q, len(results))
                                return results
                            logger.info("Planner search empty (backend=%s, query=%r)", backend, q)
                        except DDGSException as exc:
                            logger.info("DuckDuckGo search (%s backend) returned no results: %s", backend, exc)
                        except Exception as exc:
                            logger.debug("DuckDuckGo search (%s backend) error: %s", backend, exc, exc_info=True)
                    return []
            except DDGSException as exc:
                logger.debug("DuckDuckGo search returned no results: %s", exc)
                return []
            except Exception as exc:
                logger.debug("DuckDuckGo search unexpected error: %s", exc, exc_info=True)
                return []

        try:
            return await loop.run_in_executor(None, _search)
        except Exception as exc:
            logger.warning("DuckDuckGo search failed for query %s: %s", query, exc, exc_info=True)
            return []

    def _format_search_results(self, results: List[dict]) -> str:
        """
        Convert search results into a compact, readable text block.
        """
        lines = []
        for idx, item in enumerate(results, start=1):
            title = (item.get("title") or "No title").strip()
            snippet = (item.get("body") or "").strip().replace("\n", " ")
            href = (item.get("href") or "").strip()
            if len(snippet) > 200:
                snippet = snippet[:197] + "..."

            readable = f"{idx}. {title}"
            if snippet:
                readable += f" — {snippet}"
            if href:
                readable += f" (source: {href})"
            lines.append(readable)

        return "\n".join(lines)

    def _strip_source(self, line: str) -> str:
        """
        Remove source links/URLs from a summary line.
        """
        if "(source:" in line:
            line = line.split("(source:", 1)[0].rstrip()
        return line.rstrip(" -—·.")

    async def _get_search_context(self) -> str:
        """
        Run DuckDuckGo search once per planner instance and cache a readable summary.
        """
        if self._search_context is not None:
            return self._search_context
        if not self.use_search:
            self._search_context = ""
            return self._search_context
        self._search_context = ""

        queries = await self._decide_search_queries()
        if not queries:
            logger.info("Planner search skipped; no queries provided.")
            return self._search_context
        logger.info("Planner will try search queries: %s", queries)

        summary_lines: List[str] = []
        max_queries_to_use = 3
        max_summary_lines = 8

        for q in queries:
            results = await self._fetch_search_results(q, max_results=8)
            if results:
                formatted = self._format_search_results(results)
                logger.info("Planner search results for query=%r:\n%s", q, formatted)
                # Collect up to two concise lines per query for a compact summary without sources
                for idx, line in enumerate(formatted.splitlines()):
                    if idx >= 2:
                        break
                    clean_line = self._strip_source(line)
                    summary_lines.append(f"{q[:50]}... -> {clean_line}")
                    if len(summary_lines) >= max_summary_lines:
                        break
                if len(summary_lines) >= max_summary_lines or len(summary_lines) >= max_queries_to_use * 2:
                    break
            else:
                logger.info("Planner search produced no results for query=%r", q)

        if summary_lines:
            self._search_context = "Concise search summary (links removed):\n" + "\n".join(summary_lines)
            logger.info("Planner aggregated concise search summary from %d lines.", len(summary_lines))
        else:
            logger.info("Planner search produced no usable results; proceeding without external context.")

        return self._search_context

    async def _get_skill_context(self) -> str:
        """
        Load selected skill contents once per planner instance and cache a formatted context block.
        """
        if self._skill_context is not None:
            return self._skill_context

        self._skill_context = ""
        if not self.use_skills:
            return self._skill_context

        decision = await self._ensure_preplan_decision()
        if not decision.selected_skills:
            return self._skill_context

        if not self.available_skills:
            logger.info("Skills enabled but no skills available to load.")
            return self._skill_context

        skill_contents = load_skill_contents(
            self.available_skills,
            decision.selected_skills,
            max_chars=self.skills_max_chars or None,
        )
        if not skill_contents:
            return self._skill_context

        self._skill_context = format_skill_context(skill_contents)
        return self._skill_context

    async def edit_task(self) -> "PlannerResult":
        if not self.planner_llm:
            return
        controller = Controller()
        prompt_builder = PlannerPlanMessageBuilder(
            controller.registry.get_prompt_description(),
            skill_catalog=self.skill_catalog,
            use_skills=self.use_skills,
        )
        preplan = await self._ensure_preplan_decision()
        search_context = await self._get_search_context()
        skill_context = await self._get_skill_context()
        selected_skills = preplan.selected_skills if preplan else []
        messages = prompt_builder.build_initial_messages(
            task=self.task,
            search_context=search_context,
            selected_skills=selected_skills,
            skill_context=skill_context,
        )
        response = await self.planner_llm.ainvoke(messages)
        result = self._extract_planner_payload(response)
        if isinstance(result.payload, dict):
            result.payload["selected_skills"] = selected_skills
        reply_text = (result.raw_text or "").strip()
        reply_norm = reply_text.upper()
        if "REFUSE TO MAKE PLAN" in reply_norm:
            logging.error("Planner refused. Aborting.")
            raise SystemExit(1)
        self._save_planner_conversation(messages, result.raw_text, "initial")
        return result

    async def continue_edit_task(self, info_memory, task_summary) -> "PlannerResult":
        if not self.planner_llm:
            return
        controller = Controller()
        prompt_builder = PlannerPlanMessageBuilder(
            controller.registry.get_prompt_description(),
            skill_catalog=self.skill_catalog,
            use_skills=self.use_skills,
        )
        preplan = await self._ensure_preplan_decision()
        search_context = await self._get_search_context()
        skill_context = await self._get_skill_context()
        selected_skills = preplan.selected_skills if preplan else []
        messages = prompt_builder.build_continue_messages(
            task=self.task,
            info_memory=info_memory,
            task_summary=task_summary,
            plan_list=self.plan_list,
            search_context=search_context,
            selected_skills=selected_skills,
            skill_context=skill_context,
        )
        response = await self.planner_llm.ainvoke(messages)
        result = self._extract_planner_payload(response)
        if isinstance(result.payload, dict):
            result.payload["selected_skills"] = selected_skills
        reply_text = (result.raw_text or "").strip()
        reply_norm = reply_text.upper()
        if "REFUSE TO MAKE PLAN" in reply_norm:
            logging.error("Planner refused. Aborting.")
            raise SystemExit(1)
        self._save_planner_conversation(messages, result.raw_text, "continue")
        return result


@dataclass(frozen=True)
class PlannerResult:
    raw_text: str
    payload: Optional[dict]
