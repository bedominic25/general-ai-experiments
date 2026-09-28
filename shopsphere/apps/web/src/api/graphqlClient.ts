const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:4000/graphql";

export class GraphQLError extends Error {}

export async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>, token?: string | null): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors?.length) {
    throw new GraphQLError(json.errors[0].message);
  }
  return json.data as T;
}
