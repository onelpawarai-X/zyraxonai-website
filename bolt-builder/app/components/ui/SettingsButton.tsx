import { memo } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { resetLocalBuilderData } from '~/lib/persistence';

interface SettingsButtonProps {
  onClick: () => void;
}

export const SettingsButton = memo(({ onClick }: SettingsButtonProps) => {
  const handleReset = async () => {
    const confirmed = window.confirm(
      'Reset ZYRAXON Builder on this device? This will permanently delete local chats, saved browser state, and the local GitHub login from this browser.',
    );

    if (!confirmed) {
      return;
    }

    await resetLocalBuilderData();
    window.location.replace('/');
  };

  return (
    <div className="flex items-center gap-1">
      <IconButton
        onClick={onClick}
        icon="i-ph:gear"
        size="xl"
        title="Settings"
        data-testid="settings-button"
        className="text-[#666] hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/10 transition-colors"
      />
      <IconButton
        onClick={handleReset}
        icon="i-ph:trash"
        size="xl"
        title="Reset local data"
        data-testid="reset-local-data-button"
        aria-label="Reset local data"
        className="text-[#888] hover:text-red-400 hover:bg-red-500/10 transition-colors"
      />
    </div>
  );
});

interface HelpButtonProps {
  onClick: () => void;
}

export const HelpButton = memo(({ onClick }: HelpButtonProps) => {
  return (
    <IconButton
      onClick={onClick}
      icon="i-ph:question"
      size="xl"
      title="Help & Documentation"
      data-testid="help-button"
      className="text-[#666] hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/10 transition-colors"
    />
  );
});
