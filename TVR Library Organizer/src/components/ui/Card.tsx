import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  const classes = [
    'ui-card',
    `ui-card-${variant}`,
    `ui-card-p-${padding}`,
    interactive ? 'ui-card-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ className = '', children, ...rest }) => (
  <div className={`ui-card-header ${className}`} {...rest}>
    {children}
  </div>
);

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
}

export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children, ...rest }) => (
  <h3 className={`ui-card-title ${className}`} {...rest}>
    {children}
  </h3>
);

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className = '',
  children,
  ...rest
}) => (
  <p className={`ui-card-description ${className}`} {...rest}>
    {children}
  </p>
);

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardContent: React.FC<CardContentProps> = ({ className = '', children, ...rest }) => (
  <div className={`ui-card-content ${className}`} {...rest}>
    {children}
  </div>
);

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({ className = '', children, ...rest }) => (
  <div className={`ui-card-footer ${className}`} {...rest}>
    {children}
  </div>
);
