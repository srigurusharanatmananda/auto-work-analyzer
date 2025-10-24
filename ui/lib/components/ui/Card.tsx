import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-border bg-background-secondary p-6',
          hover && 'transition-all hover:border-border-hover hover:shadow-lg',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export default Card;
