import { H1_STYLE } from '../lib/typography';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? '';

  return (
    <div style={{ padding: 40 }}>
      <h1 style={H1_STYLE}>Results for: {query}</h1>
    </div>
  );
}

