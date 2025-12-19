import React, { useState, Fragment, useContext } from 'react';
import { Tooltip, message } from 'antd';
import {
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
} from '@ant-design/icons';
import { AuthContext } from 'context/AuthProvider'; // ✅ Import Auth Context

const LikeDislike = ({ singleReview }) => {
  const initialLikes = singleReview?.LikeCounter || 0;
  const initialDislikes = singleReview?.DislikeCounter || 0;
  const [state, setState] = useState({
    likes: initialLikes,
    dislikes: initialDislikes,
    action: null,
  });

  const { loggedIn } = useContext(AuthContext); // ✅ Access login state

  const API_URL = import.meta.env.VITE_APP_API_URL;
  const API_TOKEN = import.meta.env.VITE_APP_API_TOKEN;

  const updateReview = async (documentId, likeCount, dislikeCount) => {
    const lookupRes = await fetch(
      `${API_URL}property-reviews?filters[documentId][$eq]=${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      },
    );

    const lookupData = await lookupRes.json();
    const review = lookupData?.data?.[0];

    if (!review) {
      throw new Error('Review not found by documentId');
    }

    const reviewId = review.id;

    const updateRes = await fetch(`${API_URL}property-reviews/${reviewId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        data: {
          LikeCounter: likeCount,
          DislikeCounter: dislikeCount,
        },
      }),
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(
        `Failed to update review: ${updateRes.status} - ${errorText}`,
      );
    }

    return await updateRes.json();
  };

  const handleLike = async () => {
    if (!loggedIn) {
      alert('You need to log in to like a review.');
      return;
    }

    const newLikes = state.action === 'liked' ? initialLikes : initialLikes + 1;
    const newDislikes = initialDislikes;

    setState({
      likes: newLikes,
      dislikes: newDislikes,
      action: state.action === 'liked' ? null : 'liked',
    });

    try {
      await updateReview(singleReview.documentId, newLikes, newDislikes);
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleDislike = async () => {
    if (!loggedIn) {
      alert('You need to log in to dislike a review.');
      return;
    }

    const newLikes = initialLikes;
    const newDislikes =
      state.action === 'disliked' ? initialDislikes : initialDislikes + 1;

    setState({
      likes: newLikes,
      dislikes: newDislikes,
      action: state.action === 'disliked' ? null : 'disliked',
    });

    try {
      await updateReview(singleReview.documentId, newLikes, newDislikes);
    } catch (error) {
      message.error(error.message);
    }
  };

  return (
    <Fragment>
      <span className="comment-helpful">
        <Tooltip title="Like">
          {state.action === 'liked' ? (
            <LikeFilled onClick={handleLike} />
          ) : (
            <LikeOutlined onClick={handleLike} />
          )}
        </Tooltip>
        <span style={{ paddingLeft: 8 }}>{state.likes}</span>
      </span>
      <span className="comment-report">
        <Tooltip title="Dislike">
          {state.action === 'disliked' ? (
            <DislikeFilled onClick={handleDislike} />
          ) : (
            <DislikeOutlined onClick={handleDislike} />
          )}
        </Tooltip>
        <span style={{ paddingLeft: 8 }}>{state.dislikes}</span>
      </span>
    </Fragment>
  );
};

export default LikeDislike;
