from __future__ import annotations

import json
import logging
import re
from typing import Callable, Optional, Tuple

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage

from src.agent.message_manager.service import MessageManager
from src.utils.record_store import RecordStore

logger = logging.getLogger(__name__)


class BrainSearchFlow:
    def __init__(self, record_store: RecordStore) -> None:
        self.record_store = record_store

    def extract_read_files(self, parsed: dict) -> Optional[list[str]]:
        read_value = parsed.get("read_files")
        if not read_value:
            return None
        if isinstance(read_value, dict):
            files = read_value.get("files", [])
            if isinstance(files, list):
                return [str(f).strip() for f in files if str(f).strip()]
            return None
        if isinstance(read_value, list):
            return [str(f).strip() for f in read_value if str(f).strip()]
        if isinstance(read_value, str):
            return [f.strip() for f in read_value.split(",") if f.strip()]
        return None

    def parse_response(self, text: str, label: str = "Brain") -> dict:
        cleaned = re.sub(r"^```(json)?", "", text.strip())
        cleaned = re.sub(r"```$", "", cleaned).strip()
        logger.debug("[%s] Raw text: %s", label, cleaned)
        return json.loads(cleaned)

    async def maybe_reinvoke(
        self,
        parsed: dict,
        build_state_content: Callable[..., list[dict]],
        message_manager: MessageManager,
        llm: BaseChatModel,
    ) -> Tuple[dict, list[BaseMessage]]:
        read_files = self.extract_read_files(parsed)
        if read_files:
            file_contents = self.record_store.read_files(read_files)
            state_content = build_state_content(
                read_files_content=file_contents,
                read_files_list=read_files,
            )
            message_manager._remove_last_state_message()
            message_manager._remove_last_AIntool_message()
            message_manager.add_state_message(state_content)
            brain_messages = message_manager.get_messages()
            response = await llm.ainvoke(brain_messages)
            parsed = self.parse_response(str(response.content), label="Brain post-read")
            return parsed, brain_messages
        return parsed, message_manager.get_messages()
