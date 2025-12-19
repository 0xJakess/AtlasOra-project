import React from 'react';
import { Popover } from 'antd';
import moment from 'moment';
import LikeDislike from './LikeDislike';
import Rating from '../Rating/Rating';
import resolveURL from '../../../library/helpers/resolveURL';

export default class App extends React.Component {
  render() {
    const { singleReview, authorRating } = this.props;
    //todo: make these render on libe
    const authorName = singleReview
      ? singleReview.users_permissions_user?.username
      : 'Private';
    const content = singleReview ? singleReview.Review : '';
    const reviewTitle = singleReview ? singleReview.Title : '';
    const commentDate = singleReview ? singleReview.createdAt : '';
    const postTime = new Date(commentDate).getTime();

    //todo fix this as its hardcoded a avatar image for the reviews
    const authorAvatar = singleReview?.users_permissions_user?.picture?.url
      ? resolveURL(singleReview.users_permissions_user.picture.url)
      : 'https://frontend-g1i.pages.dev/images/avatar.jpeg';
    console.log(singleReview);
    // authorAvatar{resolveURL(gallery[0]?.url) || '/images/single-post-bg.jpg'}
    const reviewRating = singleReview ? singleReview.reviewFields : '';

    return (
      <div className="comment-area">
        <div className="comment-wrapper">
          <div className="comment-header">
            <div className="avatar-area">
              <div className="author-avatar">
                <img src={authorAvatar} alt={authorName} />
              </div>

              <div className="author-info">
                <h3 className="author-name">{authorName}</h3>
                {authorRating && (
                  <div className="author-rating">{authorRating}</div>
                )}
                <div className="comment-date">
                  <Popover
                    placement="bottom"
                    content={moment(commentDate).format(
                      'dddd, MMMM Do YYYY, h:mm:ss a',
                    )}
                  >
                    <span>Review - {moment(postTime).fromNow()}</span>
                  </Popover>
                </div>
              </div>
            </div>
            <div className="rating-area">
              <LikeDislike singleReview={singleReview} />
            </div>
          </div>
          <div className="comment-body">
            <h4>{reviewTitle}</h4>
            <p>{content}</p>
          </div>
          <div className="comment-rating">
            {reviewRating && reviewRating.length !== 0
              ? reviewRating.map((singleReviewRating, i) => {
                  return (
                    <div className="rating-widget" key={i}>
                      <Rating
                        key={i}
                        rating={singleReviewRating.rating}
                        ratingFieldName={singleReviewRating.ratingFieldName}
                        type="individual"
                      />
                    </div>
                  );
                })
              : ''}
          </div>
        </div>
      </div>
    );
  }
}
