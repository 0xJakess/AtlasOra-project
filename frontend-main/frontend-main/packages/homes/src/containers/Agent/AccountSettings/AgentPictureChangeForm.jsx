import React, { useContext, Fragment } from 'react';
import { Button } from 'antd';
import ImageUploader from 'components/UI/ImageUploader/ImageUploader';
import Heading from 'components/UI/Heading/Heading';
import { AgentPictureUploader, FormTitle } from './AccountSettings.style';
import { AuthContext } from 'context/AuthProvider';

export default function AgentPictureChangeForm() {
  const { loggedIn } = useContext(AuthContext);
  if (!loggedIn) {
    let navigate = useNavigate();
    navigate('/sign-in');
    return;
  }

  const { user: userInfo } = useContext(AuthContext);
  return (
    <AgentPictureUploader>
      <Heading content="Profile Image" as="h4" />
      <ImageUploader />

      <div className="submit-container">
        <Button htmlType="submit" type="primary">
          Save Changes
        </Button>
      </div>
    </AgentPictureUploader>
  );
}
