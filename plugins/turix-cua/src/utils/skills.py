from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
import re
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SkillMetadata:
    name: str
    description: str
    path: Path


@dataclass(frozen=True)
class SkillContent:
    name: str
    description: str
    body: str
    path: Path


def _normalize_skill_name(name: str) -> str:
    cleaned = re.sub(r"\s+", "-", name.strip().lower())
    return cleaned


def _split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text

    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text

    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        return {}, text

    frontmatter_lines = lines[1:end_idx]
    body = "\n".join(lines[end_idx + 1 :]).lstrip("\n")
    metadata: dict[str, str] = {}
    for line in frontmatter_lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"').strip("'")
    return metadata, body


def load_skill_metadata(skills_dir: Path) -> list[SkillMetadata]:
    if not skills_dir.exists() or not skills_dir.is_dir():
        logger.info("Skills directory not found: %s", skills_dir)
        return []

    skills: list[SkillMetadata] = []
    for path in sorted(skills_dir.glob("*.md")):
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to read skill file %s: %s", path, exc)
            continue

        metadata, _ = _split_frontmatter(text)
        name = metadata.get("name")
        description = metadata.get("description")
        if not name or not description:
            logger.warning("Skipping skill without name/description: %s", path)
            continue

        skills.append(SkillMetadata(name=name, description=description, path=path))

    return skills


def load_skill_contents(
    skills: Iterable[SkillMetadata],
    selected_names: Iterable[str],
    max_chars: Optional[int] = None,
) -> list[SkillContent]:
    selected_list = [name for name in selected_names if isinstance(name, str) and name.strip()]
    if not selected_list:
        return []

    meta_by_name = {_normalize_skill_name(s.name): s for s in skills}
    selected_contents: list[SkillContent] = []
    for raw_name in selected_list:
        normalized = _normalize_skill_name(raw_name)
        meta = meta_by_name.get(normalized)
        if not meta:
            logger.warning("Selected skill not found: %s", raw_name)
            continue
        try:
            text = meta.path.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to read skill file %s: %s", meta.path, exc)
            continue
        _, body = _split_frontmatter(text)
        body = body.strip()
        if max_chars and len(body) > max_chars:
            body = body[:max_chars].rstrip() + "\n\n[Truncated]"
        selected_contents.append(
            SkillContent(
                name=meta.name,
                description=meta.description,
                body=body,
                path=meta.path,
            )
        )
    return selected_contents


def format_skill_catalog(skills: Iterable[SkillMetadata]) -> str:
    lines = []
    for skill in skills:
        lines.append(f"- name: {skill.name}")
        lines.append(f"  description: {skill.description}")
    return "\n".join(lines)


def format_skill_context(skills: Iterable[SkillContent]) -> str:
    blocks = []
    for skill in skills:
        block = [
            f"SKILL: {skill.name}",
            f"DESCRIPTION: {skill.description}",
            "INSTRUCTIONS:",
            skill.body or "(No instructions provided.)",
        ]
        blocks.append("\n".join(block))
    return "\n\n".join(blocks)
