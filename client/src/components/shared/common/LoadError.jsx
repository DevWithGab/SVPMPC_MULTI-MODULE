export default function LoadError({ message, onRetry, retrying = false }) {
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div><p className="font-semibold">{message}</p><p className="mt-1">Previously loaded records are kept, but may be out of date.</p></div>
      <button type="button" onClick={onRetry} disabled={retrying} className="rounded-lg border border-amber-300 px-4 py-2 font-semibold hover:bg-amber-100 disabled:opacity-50">
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}
