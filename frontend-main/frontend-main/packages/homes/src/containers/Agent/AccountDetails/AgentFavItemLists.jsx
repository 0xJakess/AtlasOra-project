import React, { useContext, useEffect, useMemo } from 'react';
import SectionGrid from 'components/SectionGrid/SectionGrid';
import { PostPlaceholder } from 'components/UI/ContentLoader/ContentLoader';
import useDataApi from 'library/hooks/useDataApi';
import { SINGLE_POST_PAGE } from 'settings/constant';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from 'context/AuthProvider';
import Text from 'components/UI/Text/Text'; // ✅ Import text component for message

const AgentItemLists = () => {
  const { loggedIn } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loggedIn) {
      navigate('/sign-in');
    }
  }, [loggedIn, navigate]);

  const favoriteTitles = useMemo(() => {
    try {
      const stored = localStorage.getItem('favorites');
      console.log(stored);
      const slugs = stored ? JSON.parse(stored) : [];

      return slugs.map((slug) =>
        slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      );
    } catch (err) {
      console.error('Failed to parse favorites from localStorage', err);
      return [];
    }
  }, []);

  // ✅ Show fallback if no favorites exist
  if (favoriteTitles.length === 0) {
    return <Text content="You have no favorites yet." />;
  }

  // Create a query that matches ANY of the favorites by Title (case-insensitive)
  // filters[$or][0][Title][$eqi]=Title1&filters[$or][1][Title][$eqi]=Title2...
  const filterQuery = favoriteTitles
    .map((title, index) => `filters[$or][${index}][Title][$eqi]=${encodeURIComponent(title)}`)
    .join('&');

  const {
    data: listingsData,
    loading: listingsLoading,
    loadMoreData,
    total,
  } = useDataApi(
    `${import.meta.env.VITE_APP_API_URL}properties?${filterQuery}&populate[Images]=true&populate[property_reviews]=true`,
    import.meta.env.VITE_APP_API_TOKEN,
    10,
    [],
  );

  return (
    <SectionGrid
      link={SINGLE_POST_PAGE}
      data={listingsData}
      loading={listingsLoading}
      totalItem={total}
      columnWidth={[1 / 1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6]}
      placeholder={<PostPlaceholder />}
      handleLoadMore={loadMoreData}
    />
  );
};

export default AgentItemLists;
