import React from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'antd';

import { HOME_PAGE, LISTING_POSTS_PAGE, BACKEND_INTEGRATION_PAGE } from 'settings/constant';

const menuItems = [
  {
    label: <NavLink to={HOME_PAGE}>Homes</NavLink>,
    key: 'menu-1',
  },
  {
    label: <NavLink to={LISTING_POSTS_PAGE}>Listing</NavLink>,
    key: 'menu-2',
  }
];

const MainMenu = ({ className }) => {
  return <Menu className={className} items={menuItems} />;
};

export default MainMenu;
