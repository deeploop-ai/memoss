export type ShellTaskType =
  | 'ingest'
  | 'query'
  | 'lint'
  | 'approve'
  | 'reject'
  | 'status';

export interface ShellTaskProposal {
  task: ShellTaskType;
  params: Record<string, unknown>;
  rationale?: string;
}

export interface ShellTurnRecord {
  role: 'user' | 'assistant';
  content: string;
  task?: ShellTaskType;
}

export interface ShellTaskResult {
  task: ShellTaskType;
  success: boolean;
  summary: string;
  detail?: string;
}

export interface ShellSessionState {
  turns: ShellTurnRecord[];
  lastTask?: ShellTaskResult;
  pendingProposal?: ShellTaskProposal;
}

const MAX_TURNS = 20;

export class ShellSession {
  private readonly turns: ShellTurnRecord[] = [];
  private lastTask?: ShellTaskResult;
  pendingProposal?: ShellTaskProposal;

  addUserTurn(content: string): void {
    this.turns.push({ role: 'user', content });
    this.trim();
  }

  addAssistantTurn(content: string, task?: ShellTaskType): void {
    this.turns.push({ role: 'assistant', content, task });
    this.trim();
  }

  setLastTask(result: ShellTaskResult): void {
    this.lastTask = result;
  }

  getLastTask(): ShellTaskResult | undefined {
    return this.lastTask;
  }

  formatSessionContext(): string {
    const recent = this.turns.slice(-8);
    if (recent.length === 0) {
      return '_No prior turns in this session._';
    }
    return recent
      .map((turn) => `**${turn.role}:** ${turn.content.slice(0, 500)}`)
      .join('\n\n');
  }

  formatLastTaskResult(): string {
    if (!this.lastTask) {
      return '_No prior task in this session._';
    }
    return [
      `Task: ${this.lastTask.task}`,
      `Success: ${this.lastTask.success}`,
      `Summary: ${this.lastTask.summary}`,
      this.lastTask.detail ? `Detail: ${this.lastTask.detail.slice(0, 800)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  toJSON(): ShellSessionState {
    return {
      turns: [...this.turns],
      lastTask: this.lastTask,
      pendingProposal: this.pendingProposal,
    };
  }

  private trim(): void {
    while (this.turns.length > MAX_TURNS) {
      this.turns.shift();
    }
  }
}
