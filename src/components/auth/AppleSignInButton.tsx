interface AppleSignInButtonProps {
  onClick: () => void;
  isLoading: boolean;
  label?: string;
}

export function AppleSignInButton({ onClick, isLoading, label = "Continuar com Apple" }: AppleSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-black text-white font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ minHeight: 44, borderRadius: 8 }}
    >
      {/* Apple logo SVG - official proportions */}
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 17 20"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M13.312 10.445c-.024-2.548 2.079-3.77 2.173-3.831-1.183-1.73-3.024-1.967-3.68-1.994-1.566-.159-3.058.922-3.854.922-.795 0-2.024-.899-3.325-.874-1.71.025-3.288.995-4.168 2.527-1.777 3.085-.455 7.654 1.277 10.158.847 1.225 1.856 2.602 3.18 2.553 1.276-.051 1.758-.826 3.302-.826 1.543 0 1.978.826 3.326.8 1.373-.025 2.242-1.249 3.083-2.477.972-1.422 1.372-2.797 1.396-2.869-.03-.013-2.678-1.029-2.71-4.089zM10.772 2.883C11.47 2.035 11.94.882 11.813-.296c-.988.04-2.187.659-2.896 1.49-.634.735-1.19 1.908-1.041 3.036 1.103.086 2.229-.561 2.896-1.347z" />
      </svg>
      {label}
    </button>
  );
}
