
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getCryptoColor, getNetworkName } from "@/utils/currencyFormatter";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  network?: string;
  className?: string;
  showSign?: boolean;
  variant?: 'default' | 'large' | 'small';
}

export const CurrencyDisplay = ({ 
  amount, 
  currency, 
  network,
  className,
  showSign = true,
  variant = 'default'
}: CurrencyDisplayProps) => {
  const isPositive = amount >= 0;
  const isCrypto = !['USD', 'CAD', 'EUR', 'GBP'].includes(currency.toUpperCase());
  
  const baseClasses = cn(
    "font-mono font-medium",
    variant === 'large' && "text-2xl md:text-3xl",
    variant === 'small' && "text-sm",
    variant === 'default' && "text-base",
    className
  );

  const colorClasses = showSign 
    ? isPositive 
      ? "text-green-600" 
      : "text-red-600"
    : "text-slate-800";

  const displayAmount = showSign && amount > 0 ? `+${formatCurrency(amount, currency)}` : formatCurrency(amount, currency);

  if (isCrypto && network) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn(baseClasses, colorClasses)}>
          {displayAmount}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("text-xs", getCryptoColor(currency))}>
              {currency.toUpperCase()}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getNetworkName(network)}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <span className={cn(baseClasses, colorClasses)}>
      {displayAmount}
    </span>
  );
};
