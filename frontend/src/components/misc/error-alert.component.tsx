'use client';

import { Alert } from '@sk-web-gui/react';

interface ErrorAlertProps {
  className?: string;
  message: string;
}

/**
 * Shared presentation of an API error. Owns the role, markup and icon so errors look and are
 * announced the same wherever they appear.
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({ className, message }) => (
  <div role="alert" className={className}>
    <Alert type="error">
      <Alert.Icon />
      <Alert.Content>
        <Alert.Content.Description>{message}</Alert.Content.Description>
      </Alert.Content>
    </Alert>
  </div>
);

interface ErrorAlertListProps {
  messages: string[];
}

/** Renders several concurrent errors, e.g. metadata and errand errors on the same surface. */
export const ErrorAlertList: React.FC<ErrorAlertListProps> = ({ messages }) => (
  <>
    {messages.map((message, index) => (
      <ErrorAlert key={`${index}-${message}`} message={message} />
    ))}
  </>
);
