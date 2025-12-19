import React, { useContext, useEffect } from 'react';
import SectionGrid from 'components/SectionGrid/SectionGrid';
import { PostPlaceholder } from 'components/UI/ContentLoader/ContentLoader';
import useDataApi from 'library/hooks/useDataApi';
import { SINGLE_POST_PAGE } from 'settings/constant';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from 'context/AuthProvider';

const AgentItemLists = () => {
  const { loggedIn, user: userInfo } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loggedIn) {
      navigate('/sign-in');
    }
  }, [loggedIn, navigate]);

  const {
    data: listingsData,
    loading: listingsLoading,
    loadMoreData,
    total,
  } = useDataApi(
    `${import.meta.env.VITE_APP_API_URL}properties?filters[users_permissions_user][id][$eq]=${userInfo?.id}&populate=*&publicationState=preview`,
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
