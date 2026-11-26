import { PreWashGuide, type PreWashGuidePreviewState, type PreWashGuideState } from './PreWashGuide';

const previews: Array<{
  label: string;
  state?: PreWashGuideState;
  previewState?: PreWashGuidePreviewState;
  disabled?: boolean;
}> = [
  { label: 'default' },
  { label: 'hover', previewState: 'hover' },
  { label: 'focus', previewState: 'focus' },
  { label: 'active', previewState: 'active' },
  { label: 'disabled', disabled: true },
  { label: 'loading', state: 'loading' },
  { label: 'error', state: 'error' },
  { label: 'success', state: 'success' },
];

export function PreWashGuidePreview() {
  return (
    <main style={{ display: 'grid', gap: '2rem', maxWidth: '28rem', margin: '0 auto', padding: '2rem 1rem', background: 'var(--prewash-page)' }}>
      <section>
        <p style={{ color: 'var(--prewash-muted)', marginBlockEnd: '0.5rem' }}>car · default</p>
        <PreWashGuide isMotorcycle={false} />
      </section>
      {previews.map((preview) => (
        <section key={preview.label}>
          <p style={{ color: 'var(--prewash-muted)', marginBlockEnd: '0.5rem' }}>motorcycle · {preview.label}</p>
          <PreWashGuide
            isMotorcycle
            state={preview.state}
            previewState={preview.previewState}
            disabled={preview.disabled}
          />
        </section>
      ))}
    </main>
  );
}
