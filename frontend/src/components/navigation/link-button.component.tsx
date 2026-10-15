import { Button } from '@sk-web-gui/react';
import NextLink from 'next/link';
import { ComponentPropsWithoutRef } from 'react';

type DesignSystemButtonProps = ComponentPropsWithoutRef<typeof Button.Component>;

export type LinkButtonProps = Omit<DesignSystemButtonProps, 'as' | 'ref' | 'type'> &
  Omit<ComponentPropsWithoutRef<typeof NextLink>, keyof DesignSystemButtonProps>;

/**
 * Type-safe adapter for the design system's button rendered as a Next.js link. The installed
 * Button supports `as` at runtime, but its declaration does not keep the target's props.
 */
export const LinkButton: React.FC<LinkButtonProps> = (props) => <Button as={NextLink} {...props} />;
