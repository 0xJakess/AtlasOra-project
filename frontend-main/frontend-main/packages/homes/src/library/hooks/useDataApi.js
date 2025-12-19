// src/library/hooks/useDataApi.js
import { useState, useReducer, useEffect } from 'react';

async function SuperFetch(
  url,
  method = 'GET',
  body = {},
  token = null,
  customHeaders = {},
) {
  const headers = {
    ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...customHeaders,
  };

  const options = {
    method,
    headers,
    ...(method === 'POST' || method === 'PUT'
      ? { body: JSON.stringify(body) }
      : {}),
  };

  try {
    // Debug: request summary
    if (import.meta?.env?.MODE !== 'production') {
      console.debug('[useDataApi] →', method, url, token ? '(auth)' : '(no auth)');
    }

    const res = await fetch(url, options);
    const text = await res.text();

    if (!res.ok) {
      let details = text;
      try {
        const json = JSON.parse(text);
        details = json?.error?.message || JSON.stringify(json);
      } catch { }
      const errMsg = `HTTP error ${res.status}: ${details}`;
      console.error('[useDataApi] ✖', errMsg);
      throw new Error(errMsg);
    }

    // Parse JSON after ok
    const json = text ? JSON.parse(text) : {};
    if (import.meta?.env?.MODE !== 'production') {
      const count = Array.isArray(json?.data) ? json.data.length : 0;
      console.debug('[useDataApi] ✓', url, `items=${count}`);
    }
    return json;
  } catch (e) {
    console.error('[useDataApi] fetch failed:', e.message);
    throw e;
  }
}

function normalizeStrapiData(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (item && typeof item === 'object' && item.attributes) {
      // Flatten attributes to top-level; preserve id/documentId
      return {
        id: item.id,
        documentId: item.documentId,
        ...item.attributes,
      };
    }
    return item;
  });
}

function dataFetchReducer(state, action) {
  switch (action.type) {
    case 'FETCH_INIT':
      return { ...state, loading: true, error: false };
    case 'FETCH_SUCCESS': {
      const raw = action.payload?.data || [];
      const flat = normalizeStrapiData(raw);
      return {
        ...state,
        data: flat.slice(0, state.limit),
        total: flat,
        pagination: action.payload.meta?.pagination || null,
        loading: false,
        error: false,
      };
    }
    case 'FETCH_FAILURE':
      return { ...state, loading: false, error: true };
    case 'LOAD_MORE':
      return {
        ...state,
        data: [
          ...state.data,
          ...state.total.slice(
            state.data.length,
            state.data.length + state.limit,
          ),
        ],
      };
    default:
      throw new Error();
  }
}

const useDataApi = (
  initialUrl = null,
  token = null,
  limit = 10,
  initialData = [],
) => {
  const [url, setUrl] = useState(initialUrl);

  const [state, dispatch] = useReducer(dataFetchReducer, {
    loading: false,
    error: false,
    data: initialData,
    total: initialData,
    limit,
    pagination: null,
  });

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    const fetchData = async () => {
      dispatch({ type: 'FETCH_INIT' });

      try {
        const result = await SuperFetch(url, 'GET', {}, token);
        if (!cancelled) {
          dispatch({ type: 'FETCH_SUCCESS', payload: result });
        }
      } catch (e) {
        if (!cancelled) {
          dispatch({ type: 'FETCH_FAILURE' });
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [url, token]);

  return {
    ...state,
    doFetch: setUrl,
    loadMoreData: () => dispatch({ type: 'LOAD_MORE' }),
  };
};

export default useDataApi;
