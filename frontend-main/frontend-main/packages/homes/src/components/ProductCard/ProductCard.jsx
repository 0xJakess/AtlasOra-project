import React, { useState, useEffect } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import TextLink from 'components/UI/TextLink/TextLink';
import Rating from 'components/UI/Rating/Rating';
import Favorite from 'components/UI/Favorite/Favorite';
import Carousel from 'react-multi-carousel';
import 'react-multi-carousel/lib/styles.css';
import GridCard from '../GridCard/GridCard';
import resolveUrl from 'library/helpers/resolveURL';
import slugify from 'library/helpers/slugify';
import useFavorites from 'library/hooks/useFavorites'; // adjust path if needed
import formatPrice from 'library/helpers/formatPrice';

const responsive = {
  desktop: {
    breakpoint: {
      max: 3000,
      min: 1024,
    },
    items: 1,
    paritialVisibilityGutter: 40,
  },
  mobile: {
    breakpoint: {
      max: 464,
      min: 0,
    },
    items: 1,
    paritialVisibilityGutter: 30,
  },
  tablet: {
    breakpoint: {
      max: 1024,
      min: 464,
    },
    items: 1,
    paritialVisibilityGutter: 30,
  },
};

const PostGrid = ({
  title,
  rating,
  location,
  price,
  ratingCount,
  gallery,
  slug,
  link,
  currency,
  publishedAt,
}) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  // lStorage when the component mounts
  useEffect(() => {
    const storedFavorites = JSON.parse(localStorage.getItem('favorites')) || [];
  }, []);

  return (
    <GridCard
      isCarousel={true}
      favorite={
        <Favorite
          className={isFavorite(slugify(title)) ? 'active' : ''}
          onClick={() => toggleFavorite(slugify(title))} // Toggle favorite on click
        />
      }
      location={location}
      title={<TextLink link={`/post/${slugify(title)}`} content={title} />}
      price={`${formatPrice(price, currency)}/Night - Free Cancellation`}
      rating={<Rating rating={rating} ratingCount={ratingCount} type="bulk" />}

    >
      <Carousel
        additionalTransfrom={0}
        arrows
        autoPlaySpeed={3000}
        containerClass="container"
        dotListClass=""
        draggable
        focusOnSelect={false}
        infinite
        itemClass=""
        renderDotsOutside={false}
        responsive={responsive}
        showDots={true}
        sliderClass=""
        slidesToSlide={1}
      >
        {publishedAt === null && (
          <span
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: '#ffaa00',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 9,
            }}
          >
            Draft
          </span>
        )}
        {gallery.map(({ url, title }, index) => (
          <img
            src={resolveUrl(url)}
            alt={title}
            key={index}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'relative',
            }}
          />
        ))}
      </Carousel>
    </GridCard>
  );
};

export default PostGrid;
