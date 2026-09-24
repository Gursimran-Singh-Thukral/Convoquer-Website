export class CreateOperationsTaskDto {
  title!: string;
  /** Department this task is assigned to, e.g. 'Hospitality & Logistics'. Required unless assigneeIds is set. */
  department?: string;
  /** Assign to one or more specific volunteers instead of (or in addition to) a whole department. */
  assigneeIds?: string[];
  /**
   * Optional specific match this task concerns (e.g. a scoring duty). When set
   * together with assigneeIds, each assignee with a linked user account is
   * granted match-officiating (scorekeeper) access to this match — see
   * OperationsTasksService.syncMatchOfficials.
   */
  matchId?: string;
  priority?: string; // 'URGENT', 'STANDARD', 'STANDBY'
}

export class UpdateOperationsTaskDto {
  title?: string;
  department?: string;
  assigneeIds?: string[];
  /** Pass null/empty string to unlink the task from its match. */
  matchId?: string | null;
  priority?: string;
  status?: string; // 'STANDBY', 'IN_PROGRESS', 'DONE'
}
