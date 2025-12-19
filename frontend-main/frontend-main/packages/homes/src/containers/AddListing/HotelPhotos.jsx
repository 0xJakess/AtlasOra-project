import React, { useEffect, useState } from 'react';
import { IoIosArrowBack } from 'react-icons/io';
import { useStateMachine } from 'little-state-machine';
import { useForm } from 'react-hook-form';
import { Button, Upload, message } from 'antd';
import { FaCamera } from 'react-icons/fa';
import styled from 'styled-components';
import FormControl from 'components/UI/FormControl/FormControl';
import resolveURL from 'library/helpers/resolveURL';
import addListingAction from './AddListingAction';
import { FormHeader, Title, FormContent, FormAction } from './AddListing.style';

const { Dragger } = Upload;

// 👇 Styled wrapper retained
const ImageUploadWrapper = styled.div`
  .image-drag-area {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9f9f9;
    border: 2px dashed #d9d9d9;
    border-radius: 8px;
    height: 200px;
    margin-bottom: 12px;
    color: #999;
    font-size: 20px;
    flex-direction: column;
    cursor: pointer;

    svg {
      font-size: 32px;
      margin-bottom: 8px;
    }
  }

  .ant-upload-list-picture-card .ant-upload-list-item {
    border-radius: 8px;
  }
`;

const HotelPhotos = ({ setStep }) => {
  const { actions, state } = useStateMachine({ addListingAction });

  const {
    register,
    formState: { errors },
    setValue,
    handleSubmit,
  } = useForm({
    defaultValues: { hotelPhotos: [] },
  });

  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    register('hotelPhotos', { required: true });
  }, [register]);

  const handleUploadChange = async ({ fileList: newFileList }) => {
    const rawFiles = newFileList
      .filter((f) => !f.url) // Only new files
      .map((f) => f.originFileObj)
      .filter(Boolean);

    try {
      let uploadedData = [];

      if (rawFiles.length > 0) {
        const uploaded = await uploadToStrapi(rawFiles);
        uploadedData = uploaded.map((f) => ({
          uid: f.id,
          name: f.name,
          status: 'done',
          url: resolveURL(f.url),
          thumbUrl: f.formats?.thumbnail
            ? resolveURL(f.formats.thumbnail.url)
            : resolveURL(f.url),
          id: f.id,
        }));
      }

      const finalFileList = [
        ...newFileList.filter((f) => f.url), // Already uploaded files
        ...uploadedData,
      ];

      setFileList(finalFileList);
      setValue('hotelPhotos', finalFileList);
      message.success('Images uploaded successfully');
    } catch (err) {
      console.error(err);
      message.error('Image upload failed');
    }
  };

  const onSubmit = (data) => {
    actions.addListingAction(data);
    setStep(3);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormContent>
        <FormHeader>
          <Title>Step 2: Hotel Photos</Title>
        </FormHeader>

        <FormControl
          error={errors.hotelPhotos && <span>This field is required!</span>}
        >
          <ImageUploadWrapper>
            <Dragger
              multiple
              fileList={fileList}
              beforeUpload={() => false}
              onChange={handleUploadChange}
              listType="picture-card"
              accept="image/*"
            >
              <div className="image-drag-area">
                <FaCamera />
                <div>Click or drag files to upload</div>
              </div>
            </Dragger>
          </ImageUploadWrapper>
        </FormControl>
      </FormContent>

      <FormAction>
        <div className="inner-wrapper">
          <Button
            className="back-btn"
            htmlType="button"
            onClick={() => setStep(1)}
          >
            <IoIosArrowBack /> Back
          </Button>
          <Button type="primary" htmlType="submit">
            Next
          </Button>
        </div>
      </FormAction>
    </form>
  );
};

export default HotelPhotos;

// ✅ Upload helper (can move to a helper file if reused)
async function uploadToStrapi(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${import.meta.env.VITE_APP_API_URL}upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_APP_API_TOKEN}`,
    },
    body: formData,
  });

  if (!res.ok) throw new Error('Upload to Strapi failed');
  return await res.json(); // returns array of uploaded file data
}
