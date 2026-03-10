class OutputSchemas:
    """
    A container for all model output schemas and their associated response formats.
    """

    ACTION_SCHEMA = {
        "type": "object",
        "properties": {
            "action": {
                "type": "array",
                "minItems": 0,
                "default": [ { "wait": {} } ], 
                "items": {
                    "type": "object",
                    "properties": {
                    # ----- task finished -----
                    "done": {"type": "object",
                        "properties": {"text": {"type": "string"}}},

                    # ----- typing -----
                    "input_text": {
                        "type": "object",
                        "properties": {"text": {"type": "string"}},
                        "required": ["text"]
                    },

                    # ----- open app -----
                    "open_app": {
                        "type": "object",
                        "properties": {"app_name": {"type": "string"}},
                        "required": ["app_name"]
                    },

                    # ----- AppleScript -----
                    "run_apple_script": {
                        "type": "object",
                        "properties": {"script": {"type": "string"}},
                        "required": ["script"]
                    },

                    # ----- hotkeys -----
                    "Hotkey": {
                        "type": "object",
                        "properties": {"key": {"type": "string"}},
                        "required": ["key"]
                    },
                    "multi_Hotkey": {
                        "type": "object",
                        "properties": {
                            "key1": {"type": "string"},
                            "key2": {"type": "string"},
                            "key3": {"type": "string"},
                        },
                        "required": ["key1", "key2"]
                    },

                    # ----- clicks -----
                    "RightSingle": {
                        "type": "object",
                        "properties": {
                            "position": {
                                "type": "array",
                                "items": {"type": "number"},
                            }
                        },
                        "required": ["position"]
                    },
                    "Click": {
                        "type": "object",
                        "properties": {
                            "position": {"type": "array", "items": {"type": "number"}}
                        },
                        "required": ["position"]
                    },

                    # ----- drag -----
                    "Drag": {
                        "type": "object",
                        "properties": {
                            "position1": {"type": "array", "items": {"type": "number"}},
                            "position2": {"type": "array", "items": {"type": "number"}},
                        },
                        "required": ["position1", "position2"]
                    },

                    # ----- move mouse -----
                    "move_mouse": {
                        "type": "object",
                        "properties": {
                            "position": {"type": "array", "items": {"type": "number"}}
                        },
                        "required": ["position"]
                    },

                    # ----- scrolling -----
                    "scroll_up": {
                        "type": "object",
                        "properties": {
                            "position": {"type": "array", "items": {"type": "number"}},
                            "dx": {"type": "number"},
                            "dy": {"type": "number"},
                        },
                        "required": ["position"]
                    },
                    "scroll_down": {
                        "type": "object",
                        "properties": {
                            "position": {"type": "array", "items": {"type": "number"}},
                            "dx": {"type": "number"},
                            "dy": {"type": "number"},
                        },
                        "required": ["position"]
                    },

                    # ----- memory + wait -----
                    "record_info": {"type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "file_name": {"type": "string"}
                        },
                        "required": ["text", "file_name"]
                        },
                    "wait": {"type": "object",
                        "properties": {"text": {"type": "string"}}},
                },

                    }
                },

        },
        "required": [
            "action"
        ]
    }

    ACTION_RESPONSE_FORMAT = {
        "type": "json_schema",
        "json_schema": {
            "name": "agent_action_output",
            "strict": True,
            "schema": ACTION_SCHEMA
        }
    }

    BRAIN_SCHEMA = {
        "oneOf": [
            {
                "type": "object",
                "properties": {
                    "analysis": {
                        "type": "object",
                        "properties": {
                            "analysis": {"type": "string"},
                            "sop_check": {"type": "string"}
                        },
                        "required": ["analysis", "sop_check"]
                    },
                    "current_state": {
                        "type": "object",
                        "properties": {
                            "step_evaluate": {"type": "string"},
                            "ask_human": {"type": "string"},
                            "next_goal": {"type": "string"},
                        },
                        "required": [
                            "step_evaluate",
                            "ask_human",
                            "next_goal"
                        ]
                    },
                },
                "required": ["analysis", "current_state"],
                "additionalProperties": False
            },
            {
                "type": "object",
                "properties": {
                    "read_files": {
                        "type": "object",
                        "properties": {
                            "files": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 1
                            }
                        },
                        "required": ["files"]
                    }
                },
                "required": ["read_files"],
                "additionalProperties": False
            }
        ]
    }

    BRAIN_RESPONSE_FORMAT = {
        "type": "json_schema",
        "json_schema": {
            "name": "agent_state_output",
            "strict": True,
            "schema": BRAIN_SCHEMA
        }
    }

    MEMORY_SCHEMA = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "file_name": {"type": "string"}
        },
        "required": ["summary", "file_name"]
    }

    MEMORY_RESPONSE_FORMAT = {
        "type": "json_schema",
        "json_schema": {
            "name": "memory_output",
            "strict": True,
            "schema": MEMORY_SCHEMA
        }
    }

    PLANNER_SCHEMA = {
        "type": "object",
        "properties": {
            "iteration_info": {
                "type": "object",
                "properties": {
                    "current_iteration": {"type": "integer", "minimum": 1},
                    "total_iterations": {"type": "integer", "minimum": 1}
                },
                "required": ["current_iteration", "total_iterations"],
                "additionalProperties": False
            },
            "search_summary": {"type": "string"},
            "selected_skills": {
                "type": "array",
                "items": {"type": "string"},
                "default": []
            },
            "natural_language_plan": {
                "type": "string"
            },
            "step_by_step_plan": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "step_id": {
                            "type": "string",
                            "pattern": "^Step \\d+$"
                        },
                        "description": {
                            "type": "string"
                        },
                        "important_search_info": {
                            "type": "string"
                        }
                    },
                    "required": ["step_id", "description", "important_search_info"],
                    "additionalProperties": False
                }
            }
        },
        "required": ["iteration_info", "search_summary", "selected_skills", "step_by_step_plan"],
        "additionalProperties": False
    }

    PLANNER_RESPONSE_FORMAT = {
        "type": "json_schema",
        "json_schema": {
            "name": "planner_output",
            "strict": True,
            "schema": PLANNER_SCHEMA
        }
    }
