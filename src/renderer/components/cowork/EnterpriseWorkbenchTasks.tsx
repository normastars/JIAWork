import { ArrowRightIcon } from '@heroicons/react/24/outline';
import React from 'react';

import type { LocalizedEnterpriseWorkbenchAction } from '../../services/enterpriseWorkbench';

type EnterpriseWorkbenchTasksProps = {
  actions: LocalizedEnterpriseWorkbenchAction[];
  onSelect: (action: LocalizedEnterpriseWorkbenchAction) => void;
};

const EnterpriseWorkbenchTasks: React.FC<EnterpriseWorkbenchTasksProps> = ({ actions, onSelect }) => {
  if (actions.length === 0) return null;

  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
      {actions.map(action => (
        <button
          key={action.id}
          type="button"
          onClick={() => onSelect(action)}
          className="group flex min-h-[82px] items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-surface-raised hover:shadow-subtle active:translate-y-0 active:scale-[0.99]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              {action.label}
            </span>
            {action.description && (
              <span className="mt-1 block text-xs leading-5 text-secondary">
                {action.description}
              </span>
            )}
          </span>
          <ArrowRightIcon className="mt-0.5 h-4 w-4 shrink-0 -translate-x-1 text-secondary opacity-0 transition-all group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
};

export default EnterpriseWorkbenchTasks;
