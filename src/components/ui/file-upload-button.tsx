"use client";

import { useId, useRef, type ComponentProps } from 'react';
import { Upload } from 'lucide-react';

type FileUploadButtonProps = Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  buttonLabel?: string;
  statusText?: string;
};

/** MSP Coffee standard: a visible, keyboard-accessible green upload action. */
export function FileUploadButton({ buttonLabel = 'Upload File', statusText = 'No file uploaded yet', disabled, id, ...inputProps }: FileUploadButtonProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const input = useRef<HTMLInputElement>(null);
  return <div className="msp-upload-control">
    <button type="button" className="msp-action-button" disabled={disabled} aria-controls={inputId}
      onClick={() => input.current?.click()}>
      <Upload size={20} aria-hidden="true" />{buttonLabel}
    </button>
    <span className="msp-upload-status" role="status">{statusText}</span>
    <input {...inputProps} id={inputId} ref={input} type="file" hidden disabled={disabled} />
  </div>;
}
