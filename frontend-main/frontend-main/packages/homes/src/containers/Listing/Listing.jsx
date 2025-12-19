import React, { useState, useEffect, Fragment, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sticky from 'react-stickynode';
import { Checkbox } from 'antd';

import useWindowSize from 'library/hooks/useWindowSize';
import useDataApi from 'library/hooks/useDataApi';
import useStrapiPropertySearchUrl from 'library/hooks/useStrapiPropertySearchUrl';

import Toolbar from 'components/UI/Toolbar/Toolbar';
import { PostPlaceholder } from 'components/UI/ContentLoader/ContentLoader';
import SectionGrid from 'components/SectionGrid/SectionGrid';
import FilterDrawer from './Search/MobileSearchView';
import CategorySearch from './Search/CategorySearch/CategorySearch';
import ListingMap from './ListingMap';

import { SINGLE_POST_PAGE } from 'settings/constant';
import ListingWrapper, { PostsWrapper, ShowMapCheckbox } from './Listing.style';

const PARAMS_KEY = 'listing_search_params';

export default function Listing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const [showMap, setShowMap] = useState(false);
  const [searchReady, setSearchReady] = useState(false);
  const strapiUrl = useStrapiPropertySearchUrl(location.search);
  const hasQuery = location.search && location.search.length > 1;
  const adminBaseUrl = useMemo(() => (import.meta.env.VITE_APP_API_URL || 'http://localhost:1337/api/'), []);
  const defaultUrl = useMemo(() => {
    const base = adminBaseUrl.endsWith('/') ? adminBaseUrl : `${adminBaseUrl}/`;
    return `${base}properties?publicationState=preview&populate=*`;
  }, [adminBaseUrl]);

  // 1. On first load, fallback to stored filters if no query
  // 1. On first load, always show all if no query (don't restore old search)
  useEffect(() => {
    if (!hasQuery) {
      localStorage.removeItem(PARAMS_KEY);
    }
    setSearchReady(true);
  }, []); // Run only once on mount

  // 2. On query param change (e.g., nav search), update all stored filters
  useEffect(() => {
    //debug code
    // location.search =
    //'?startDate=07-11-2025&endDate=07-12-2025&room=1&guest=1&address=great&amenities=free-wifi&property=Villa&date_range=07-11-2025,07-12-2025';
    //console.log('location.search', location.search);
    if (!location.search) return;

    const currentParams = new URLSearchParams(location.search);
    const storedParams = new URLSearchParams(
      localStorage.getItem(PARAMS_KEY) || '',
    );

    // Merge all current query params into stored
    for (const [key, value] of currentParams.entries()) {
      storedParams.set(key, value);
    }

    let updatedSearch = `?${storedParams.toString()}`;
    // console.log(updatedSearch);
    //note : this is an example so we can test filter rendering
    //updatedSearch =
    //  '?startDate=07-11-2025&endDate=07-12-2025&room=1&guest=1&address=great&amenities=free-wifi&property=Villa&date_range=2025-07-11,2025-07-12';

    localStorage.setItem(PARAMS_KEY, updatedSearch);
    setSearchReady(true);
  }, [location.search]);

  // 3. Data fetching
  const { data, total, loading, error, loadMoreData, doFetch } = useDataApi(
    null,
    import.meta.env.VITE_APP_API_TOKEN,
    10,
  );

  const maxPriceFromData = useMemo(() => {
    if (!data || data.length === 0) return 500; // fallback
    return Math.max(...data.map((item) => item.PricePerNight * 2 || 0));
  }, [data]);

  useEffect(() => {
    if (!searchReady) return;
    doFetch(strapiUrl || defaultUrl);
  }, [searchReady, strapiUrl, defaultUrl, doFetch]);

  const limit = 100;
  const columnWidth = showMap
    ? [1 / 1, 1 / 2, 1 / 2, 1 / 2, 1 / 3]
    : [1 / 1, 1 / 2, 1 / 3, 1 / 4, 1 / 5];

  const handleMapToggle = () => setShowMap((prev) => !prev);
  const isEmpty = !loading && data.length === 0;
  const isLoadMoreVisible = data.length < (total?.length || 0);

  return (
    <ListingWrapper>
      <Sticky top={82} innerZ={999} activeClass="isHeaderSticky">
        <Toolbar
          left={
            width > 991 ? (
              <CategorySearch location={location} maxPrice={maxPriceFromData} />
            ) : (
              <FilterDrawer location={location} />
            )
          }
          right={
            <ShowMapCheckbox>
              {/*
              <Checkbox defaultChecked={false} onChange={handleMapToggle}>
                Show map
              </Checkbox>
              */}
            </ShowMapCheckbox>
          }
        />
      </Sticky>

      <Fragment>
        <PostsWrapper className={width > 767 && showMap ? 'col-12' : 'col-24'}>
          {isEmpty ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h3>No properties found. Try adjusting your filters.</h3>
            </div>
          ) : (
            <SectionGrid
              link={SINGLE_POST_PAGE}
              columnWidth={columnWidth}
              data={data}
              totalItem={data.length}
              loading={loading}
              limit={limit}
              handleLoadMore={isLoadMoreVisible ? loadMoreData : null}
              placeholder={<PostPlaceholder />}
            />
          )}
        </PostsWrapper>

        {showMap && <ListingMap />}
      </Fragment>
    </ListingWrapper>
  );
}
