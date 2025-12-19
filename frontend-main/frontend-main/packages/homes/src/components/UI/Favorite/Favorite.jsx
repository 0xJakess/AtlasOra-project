import React from 'react';
import PropTypes from 'prop-types';
import FavoriteWrapper from './Favorite.style';

const Favorite = ({
  className = '',
  content,
  onClick = () => {},
  isActive,
}) => {
  const classes = ['favorite'];
  if (className) classes.push(className);
  if (isActive) classes.push('active');

  return (
    <FavoriteWrapper onClick={onClick} className={classes.join(' ')}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.64 18.232">
        <path
          d="M60.16,56h-.04a4.551,4.551,0,0,0-3.8,2.08A4.551,4.551,0,0,0,52.52,56h-.04A4.522,4.522,0,0,0,48,60.52a9.737,9.737,0,0,0,1.912,5.308A33.506,33.506,0,0,0,56.32,72a33.506,33.506,0,0,0,6.408-6.172A9.737,9.737,0,0,0,64.64,60.52,4.522,4.522,0,0,0,60.16,56Z"
          transform="translate(-47 -55)"
        />
      </svg>
      {content && <span>{content}</span>}
    </FavoriteWrapper>
  );
};

Favorite.propTypes = {
  className: PropTypes.string,
  content: PropTypes.string,
  onClick: PropTypes.func,
  isActive: PropTypes.bool.isRequired, // ✅ NEW
};

export default Favorite;
