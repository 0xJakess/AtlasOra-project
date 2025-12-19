import React, { useState } from 'react';
import { useNavigate, createSearchParams } from 'react-router-dom';
import moment from 'moment';
import { Button, Slider, Checkbox } from 'antd';
import ViewWithPopup from 'components/UI/ViewWithPopup/ViewWithPopup';
import InputIncDec from 'components/UI/InputIncDec/InputIncDec';
import DateRangePicker from 'components/UI/DatePicker/ReactDates';
import { setStateToUrl, getStateFromUrl } from 'library/helpers/url-handler';

import { LISTING_POSTS_PAGE } from 'settings/constant';
import { calenderItem, getAmenities, getPropertyType } from '../SearchParams';
import CategorySearchWrapper, {
  RoomGuestWrapper,
  ItemWrapper,
  ActionWrapper,
} from './CategorySearch.style';

const CategorySearch = ({ location, maxPrice = 500 }) => {
  const navigate = useNavigate();
  const searchParams = getStateFromUrl(location, maxPrice);

  // Load from localStorage if needed
  const savedParams = localStorage.getItem('listing_search_params') || '';
  const savedSearchParams = new URLSearchParams(savedParams);
  const fallbackAddress = savedSearchParams.get('address') || '';

  const address = searchParams.address || fallbackAddress;

  const state = {
    amenities: searchParams.amenities || [],
    property: searchParams.property || [],
    date_range: searchParams.date_range || {
      setStartDate: null,
      setEndDate: null,
    },
    price: searchParams.price || {
      min: 0,
      max: maxPrice,
      defaultMin: 0,
      defaultMax: maxPrice,
    },
    location: searchParams.location || {
      lat: null,
      lng: null,
    },
    address,
    room: parseInt(searchParams.room) || 0,
    guest: parseInt(searchParams.guest) || 0,
  };

  const { amenities, property, date_range, price, room, guest } = state;
  const [countRoom, setRoom] = useState(room);
  const [countGuest, setGuest] = useState(guest);

  const onChange = (value, type) => {
    const currentState = getStateFromUrl(location, maxPrice);

    const updatedState = {
      ...currentState,
      [type]: value,
      address: currentState.address || address,
    };

    if (type === 'price') {
      const [min, max] = value;
      updatedState.price = {
        min,
        max,
        defaultMin: 0,
        defaultMax: Math.max(max, maxPrice),
      };
    }

    const search = setStateToUrl(updatedState, location);

    navigate({
      pathname: LISTING_POSTS_PAGE,
      search: `?${createSearchParams(search)}`,
    });
  };

  const handleRoomGuestApply = () => {
    const query = {
      ...state,
      room: countRoom,
      guest: countGuest,
    };

    const search = setStateToUrl(query, location);
    navigate({
      pathname: LISTING_POSTS_PAGE,
      search: `?${createSearchParams(search)}`,
    });
  };

  const handleRoomGuestCancel = () => {
    setRoom(0);
    setGuest(0);

    const query = { ...state, room: 0, guest: 0 };
    const search = setStateToUrl(query, location);
    navigate({
      pathname: LISTING_POSTS_PAGE,
      search: `?${createSearchParams(search)}`,
    });
  };

  const onSearchReset = () => {
    const resetState = {
      amenities: [],
      property: [],
      date_range: {
        setStartDate: null,
        setEndDate: null,
      },
      price: {
        min: 0,
        max: maxPrice,
        defaultMin: 0,
        defaultMax: maxPrice,
      },
      location: { lat: null, lng: null },
      address: '',
      room: 0,
      guest: 0,
    };

    const search = setStateToUrl(resetState, location);
    navigate({
      pathname: LISTING_POSTS_PAGE,
      search: `?${createSearchParams(search)}`,
    });
  };

  return (
    <CategorySearchWrapper>
      {/* Amenities */}
      <ViewWithPopup
        className={amenities.length ? 'activated' : ''}
        key={getAmenities.id}
        noView
        view={
          <Button type="default">
            {getAmenities.name}
            {amenities.length > 0 && `: ${amenities.length}`}
          </Button>
        }
        popup={
          <Checkbox.Group
            options={getAmenities.options}
            defaultValue={amenities}
            onChange={(value) => onChange(value, 'amenities')}
          />
        }
      />

      {/* Property Type */}
      <ViewWithPopup
        className={property.length ? 'activated' : ''}
        key={getPropertyType.id}
        noView
        view={
          <Button type="default">
            {getPropertyType.name}
            {property.length > 0 && `: ${property.length}`}
          </Button>
        }
        popup={
          <Checkbox.Group
            options={getPropertyType.options}
            defaultValue={property}
            onChange={(value) => onChange(value, 'property')}
          />
        }
      />

      {/* Date Picker */}
      <ViewWithPopup
        className={
          date_range.setStartDate && date_range.setEndDate ? 'activated' : ''
        }
        key={400}
        noView
        view={<Button type="default">Choose Date</Button>}
        popup={
          <DateRangePicker
            startDateId="startDate-id-category"
            endDateId="endDate-id-category"
            startDate={
              date_range.setStartDate
                ? moment(date_range.setStartDate, 'MM-DD-YYYY')
                : null
            }
            endDate={
              date_range.setEndDate
                ? moment(date_range.setEndDate, 'MM-DD-YYYY')
                : null
            }
            numberOfMonths={1}
            small
            item={calenderItem}
            updateSearchData={(value) => onChange(value, 'date_range')}
          />
        }
      />

      {/* Price Slider */}
      <ViewWithPopup
        className={
          price.min !== price.defaultMin || price.max !== price.defaultMax
            ? 'activated'
            : ''
        }
        key={300}
        noView
        view={
          <Button type="default">
            {price.min > 0 || price.max < maxPrice
              ? `Price: ${price.min}, ${price.max}`
              : `Price per night`}
          </Button>
        }
        popup={
          <Slider
            range
            marks={{ 0: '$0', [price.defaultMax]: `$${price.defaultMax}` }}
            min={price.defaultMin}
            max={price.defaultMax}
            defaultValue={[price.min, price.max]}
            onAfterChange={(value) => onChange(value, 'price')}
          />
        }
      />

      {/* Room & Guest */}
      <ViewWithPopup
        key={200}
        noView
        className={countRoom || countGuest ? 'activated' : ''}
        view={
          <Button type="default">
            Room {countRoom > 0 && `: ${countRoom}`}, Guest{' '}
            {countGuest > 0 && `: ${countGuest}`}
          </Button>
        }
        popup={
          <RoomGuestWrapper>
            <ItemWrapper>
              <strong>Room</strong>
              <InputIncDec
                id="room"
                increment={() => setRoom((c) => c + 1)}
                decrement={() => setRoom((c) => Math.max(0, c - 1))}
                onChange={(e) => setRoom(Number(e.target.value))}
                value={countRoom}
              />
            </ItemWrapper>
            <ItemWrapper>
              <strong>Guest</strong>
              <InputIncDec
                id="guest"
                increment={() => setGuest((c) => c + 1)}
                decrement={() => setGuest((c) => Math.max(0, c - 1))}
                onChange={(e) => setGuest(Number(e.target.value))}
                value={countGuest}
              />
            </ItemWrapper>
            <ActionWrapper>
              {(countRoom || countGuest) && (
                <Button type="default" onClick={handleRoomGuestCancel}>
                  Clear
                </Button>
              )}
              <Button type="primary" onClick={handleRoomGuestApply}>
                Apply
              </Button>
            </ActionWrapper>
          </RoomGuestWrapper>
        }
      />

      {/* Reset */}
      <div className="view_with__popup">
        <div className="popup_handler">
          <Button type="default" onClick={onSearchReset}>
            Reset
          </Button>
        </div>
      </div>
    </CategorySearchWrapper>
  );
};

export default CategorySearch;
