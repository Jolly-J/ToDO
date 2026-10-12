/** 任务成员选择校验工具，确保负责人必须在成员列表中 */
interface ValidateTaskMemberSelectionInput {
  memberIds: string[];
  assigneeId?: string;
  participantIds?: string[];
}

interface ValidateTaskMemberSelectionResult {
  invalidAssigneeId?: string;
  invalidParticipantIds: string[];
}

export function validateTaskMemberSelection({
  memberIds,
  assigneeId,
  participantIds = [],
}: ValidateTaskMemberSelectionInput): ValidateTaskMemberSelectionResult {
  const memberIdSet = new Set(memberIds);
  const uniqueParticipantIds = [...new Set(participantIds.filter(Boolean))];

  return {
    invalidAssigneeId: assigneeId && !memberIdSet.has(assigneeId) ? assigneeId : undefined,
    invalidParticipantIds: uniqueParticipantIds.filter((participantId) => !memberIdSet.has(participantId)),
  };
}
