import React, { useEffect, useState } from 'react';
import { Input } from 'antd';
import {
  useNavigate,
  createSearchParams,
  useSearchParams,
} from 'react-router-dom';
import { setStateToUrl } from 'library/helpers/url-handler';

const MapAutoComplete = ({ getInputValue }) => {
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState('');
  const navigate = useNavigate();

  // Populate from URL on mount
  useEffect(() => {
    const addressFromUrl = searchParams.get('address') || '';
    setSearchValue(addressFromUrl);
    getInputValue?.({ searchedLocation: addressFromUrl });
  }, []);

  const handleOnChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    getInputValue?.({ searchedLocation: value });
  };

  const handleOnPressEnter = (event) => {
    if (event.which === 13 || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();

      const query = setStateToUrl({ address: searchValue });

      navigate({
        pathname: '/listing',
        search: `?${createSearchParams(query)}`,
      });
    }
  };

  return (
    <div className="map_autocomplete">
      <Input
        type="text"
        value={searchValue}
        placeholder="Search 'Thailand, Asia'"
        size="large"
        onChange={handleOnChange}
        onPressEnter={handleOnPressEnter}
      />
    </div>
  );
};

export default MapAutoComplete;
