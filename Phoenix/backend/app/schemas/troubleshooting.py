"""Troubleshooting guide graph API request and response schemas."""

from datetime import UTC, datetime
from typing import Literal, Self
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TroubleshootingStepType = Literal["question", "complete", "handoff"]
TroubleshootingAnswer = Literal["yes", "no", "unknown"]
REQUIRED_ANSWERS = frozenset({"yes", "no", "unknown"})


def normalize_required_text(value: object) -> object:
    """Trim required guide text before applying length validation."""
    return value.strip() if isinstance(value, str) else value


def normalize_optional_text(value: object) -> object:
    """Trim optional guide text and represent blanks as no value."""
    if not isinstance(value, str):
        return value
    normalized = value.strip()
    return normalized or None


class TroubleshootingStepCreate(BaseModel):
    """Validated input for one graph step with a client-generated stable ID."""

    model_config = ConfigDict(extra="forbid")

    step_id: UUID
    step_type: TroubleshootingStepType
    prompt: str = Field(min_length=1, max_length=500)
    check_method: str | None = Field(default=None, max_length=500)
    caution_note: str | None = Field(default=None, max_length=500)

    _normalize_prompt = field_validator("prompt", mode="before")(
        normalize_required_text
    )
    _normalize_optional_fields = field_validator(
        "check_method",
        "caution_note",
        mode="before",
    )(normalize_optional_text)


class TroubleshootingBranchCreate(BaseModel):
    """Validated input for one answer transition within the submitted graph."""

    model_config = ConfigDict(extra="forbid")

    branch_id: UUID = Field(default_factory=uuid4)
    from_step_id: UUID
    answer: TroubleshootingAnswer
    to_step_id: UUID


class TroubleshootingGuideCreate(BaseModel):
    """Atomic create request for one complete and safe guide graph."""

    model_config = ConfigDict(extra="forbid")

    equipment_id: UUID
    symptom: str = Field(min_length=1, max_length=200)
    start_step_id: UUID
    display_order: int = Field(default=0, ge=0, le=9999)
    is_active: bool = True
    steps: list[TroubleshootingStepCreate] = Field(min_length=1, max_length=100)
    branches: list[TroubleshootingBranchCreate] = Field(
        default_factory=list,
        max_length=300,
    )

    _normalize_symptom = field_validator("symptom", mode="before")(
        normalize_required_text
    )

    @model_validator(mode="after")
    def validate_complete_graph(self) -> Self:
        """Reject incomplete, cyclic, cross-guide, or unsafe unknown routes."""
        step_by_id = {step.step_id: step for step in self.steps}
        if len(step_by_id) != len(self.steps):
            raise ValueError("step_id values must be unique within one guide.")
        if self.start_step_id not in step_by_id:
            raise ValueError("start_step_id must reference a submitted step.")

        branch_ids = {branch.branch_id for branch in self.branches}
        if len(branch_ids) != len(self.branches):
            raise ValueError("branch_id values must be unique within one guide.")

        outgoing: dict[UUID, dict[str, UUID]] = {step_id: {} for step_id in step_by_id}
        for branch in self.branches:
            if branch.from_step_id not in step_by_id:
                raise ValueError("A branch source must belong to the submitted guide.")
            if branch.to_step_id not in step_by_id:
                raise ValueError("A branch target must belong to the submitted guide.")
            answers = outgoing[branch.from_step_id]
            if branch.answer in answers:
                raise ValueError("Each question can have only one branch per answer.")
            answers[branch.answer] = branch.to_step_id

        for step_id, step in step_by_id.items():
            answers = outgoing[step_id]
            if step.step_type == "question":
                if set(answers) != REQUIRED_ANSWERS:
                    raise ValueError(
                        "Question steps require exactly YES, NO, and unknown branches."
                    )
                unknown_target = step_by_id[answers["unknown"]]
                if unknown_target.step_type != "handoff":
                    raise ValueError(
                        "The unknown branch must lead directly to a handoff step."
                    )
            elif answers:
                raise ValueError("Complete and handoff steps cannot have branches.")

        visited: set[UUID] = set()
        visiting: set[UUID] = set()

        def visit(step_id: UUID) -> None:
            if step_id in visiting:
                raise ValueError("Troubleshooting guides cannot contain cycles.")
            if step_id in visited:
                return
            visiting.add(step_id)
            for target_id in outgoing[step_id].values():
                visit(target_id)
            visiting.remove(step_id)
            visited.add(step_id)

        visit(self.start_step_id)
        if visited != set(step_by_id):
            raise ValueError("Every step must be reachable from start_step_id.")
        return self


class TroubleshootingStepResponse(BaseModel):
    """Public representation of one persisted troubleshooting step."""

    model_config = ConfigDict(extra="forbid")

    step_id: UUID
    step_type: TroubleshootingStepType
    prompt: str
    check_method: str | None
    caution_note: str | None


class TroubleshootingBranchResponse(BaseModel):
    """Public representation of one persisted troubleshooting transition."""

    model_config = ConfigDict(extra="forbid")

    branch_id: UUID
    from_step_id: UUID
    answer: TroubleshootingAnswer
    to_step_id: UUID


class TroubleshootingGuideSummaryResponse(BaseModel):
    """List representation of one troubleshooting guide."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    equipment_id: UUID
    symptom: str
    start_step_id: UUID
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        """Represent SQLite timestamps consistently as UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class TroubleshootingGuideDetailResponse(TroubleshootingGuideSummaryResponse):
    """Complete guide graph returned after creation or detail lookup."""

    steps: list[TroubleshootingStepResponse]
    branches: list[TroubleshootingBranchResponse]


class TroubleshootingGuideListResponse(BaseModel):
    """Paginated troubleshooting guide summaries."""

    model_config = ConfigDict(extra="forbid")

    items: list[TroubleshootingGuideSummaryResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)
