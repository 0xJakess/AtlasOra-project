import React from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'antd';

import {
  HOME_PAGE,
  LISTING_POSTS_PAGE,
  PRIVACY_PAGE,
  PRICING_PLAN_PAGE,
  AGENT_PROFILE_PAGE,
} from 'settings/constant';

const navigations = [
  {
    label: <NavLink to={`${HOME_PAGE}`}>Homes</NavLink>,
    key: 'hotels',
  },
  {
    label: <NavLink to={`${LISTING_POSTS_PAGE}`}>Listing</NavLink>,
    key: 'listing',
  },
  {
    label: <NavLink to={`${PRIVACY_PAGE}`}>Privacy</NavLink>,
    key: 'privacy',
  },
];

const FooterMenu = () => {
  return <Menu items={navigations} />;
};

export default FooterMenu;
