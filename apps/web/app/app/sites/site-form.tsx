'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { SiteFormState } from '../../../lib/site-management';

const SubmitButton = ({ label }: { label: string }) => {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
};

const FieldError = ({ messages }: { messages?: string[] }) =>
  messages?.length ? (
    <p className="field-error" role="alert">
      {messages[0]}
    </p>
  ) : null;

export const SiteForm = ({
  action,
  cancelHref,
  initialState,
  submitLabel,
}: {
  action: (state: SiteFormState, formData: FormData) => Promise<SiteFormState>;
  cancelHref: string;
  initialState: SiteFormState;
  submitLabel: string;
}) => {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="site-form">
      <label>
        <span>Site name</span>
        <input
          type="text"
          name="name"
          defaultValue={state.values.name}
          maxLength={120}
          required
        />
      </label>
      <FieldError messages={state.fieldErrors?.name} />

      <label>
        <span>Primary URL</span>
        <input
          type="url"
          name="primaryUrl"
          defaultValue={state.values.primaryUrl}
          maxLength={2048}
          placeholder="https://example.com"
          required
        />
      </label>
      <FieldError messages={state.fieldErrors?.primaryUrl} />

      <label>
        <span>Sitemap URL</span>
        <input
          type="url"
          name="sitemapUrl"
          defaultValue={state.values.sitemapUrl}
          maxLength={2048}
          placeholder="https://example.com/sitemap.xml"
        />
      </label>
      <FieldError messages={state.fieldErrors?.sitemapUrl} />

      {state.formError ? (
        <p className="field-error" role="alert">
          {state.formError}
        </p>
      ) : null}

      <div className="actions">
        <SubmitButton label={submitLabel} />
        <a href={cancelHref} className="secondary-action">
          Cancel
        </a>
      </div>
    </form>
  );
};
