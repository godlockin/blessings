import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { blessingStyles, getDefaultStyle, type BlessingStyle, type BlessingStyleId } from '@/constants/blessingStyles';
import { cn } from '@/lib/utils';

interface BlessingStyleSelectorProps {
  selectedId: BlessingStyleId;
  onSelect: (style: BlessingStyle) => void;
  disabled?: boolean;
}

export function BlessingStyleSelector({ selectedId, onSelect, disabled }: BlessingStyleSelectorProps) {
  const selectedStyle = useMemo(
    () => blessingStyles.find(s => s.id === selectedId) || getDefaultStyle(),
    [selectedId]
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        选择祝福风格
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {blessingStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelect(style)}
            disabled={disabled}
            className={cn(
              'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
              'hover:shadow-md hover:scale-[1.02]',
              selectedId === style.id
                ? 'border-china-red bg-red-50 dark:bg-red-900/20 shadow-china-red/20'
                : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bgSecondary hover:border-china-red/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={selectedId === style.id ? { borderColor: style.themeColor } : undefined}
          >
            <div className="text-2xl mb-2">{style.icon}</div>
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {style.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {style.description}
            </div>

            {selectedId === style.id && (
              <div
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: style.themeColor }}
              >
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-bgTertiary rounded-xl">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          示例祝福语
        </div>
        <div className="space-y-1">
          {selectedStyle.examples.map((example, index) => (
            <div key={index} className="text-sm text-gray-700 dark:text-gray-300">
              {example}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BlessingStyleSelector;
