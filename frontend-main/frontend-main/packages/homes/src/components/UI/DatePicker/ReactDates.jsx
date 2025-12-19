import 'react-dates/initialize';
import { DateRangePicker } from 'react-dates';
import 'react-dates/lib/css/_datepicker.css';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ReactDatesStyleWrapper } from './ReactDates.style';

class DateRangePickerBox extends Component {
  constructor(props) {
    super(props);
    const separator =
      this.props.item && this.props.item.separator
        ? this.props.item.separator
        : '/';
    const dateFormat =
      this.props.item && this.props.item.format
        ? this.props.item.format
        : 'llll';

    this.state = {
      focusedInput: null,
      startDate: this.isMoment(this.props.startDate)
        ? this.props.startDate
        : null,
      endDate: this.isMoment(this.props.endDate) ? this.props.endDate : null,
      dateFormat,
      separator,
    };
  }

  componentDidUpdate(prevProps) {
    // Sync external start/end dates if they change
    if (
      prevProps.startDate !== this.props.startDate ||
      prevProps.endDate !== this.props.endDate
    ) {
      this.setState({
        startDate: this.isMoment(this.props.startDate)
          ? this.props.startDate
          : null,
        endDate: this.isMoment(this.props.endDate) ? this.props.endDate : null,
      });
    }
  }

  isMoment = (date) => {
    return (
      date && typeof date === 'object' && typeof date.format === 'function'
    );
  };

  onDateChangeFunc = ({ startDate, endDate }) => {
    const { dateFormat } = this.state;
    this.setState({ startDate, endDate });

    if (this.isMoment(startDate) && this.isMoment(endDate)) {
      this.props.updateSearchData?.({
        setStartDate: startDate.format(dateFormat),
        setEndDate: endDate.format(dateFormat),
        startMoment: startDate,
        endMoment: endDate,
      });
    }
  };

  onFocusChangeFunc = (focusedInput) => {
    this.setState({ focusedInput });
  };

  render() {
    const { focusedInput, startDate, endDate } = this.state;

    const {
      className,
      startDateId,
      endDateId,
      startDatePlaceholderText,
      endDatePlaceholderText,
      disabled,
      showClearDates,
      isRTL,
      orientation,
      anchorDirection,
      withPortal,
      withFullScreenPortal,
      small,
      block,
      numberOfMonths,
      regular,
      noBorder,
    } = this.props;

    const addAllClasses = ['date_picker'];
    if (className) {
      addAllClasses.push(className);
    }

    const defaultCalenderProps = {
      startDateId: startDateId || 'start_unique_id',
      endDateId: endDateId || 'end_date_unique_id',
      startDate,
      endDate,
      focusedInput,
      onFocusChange: this.onFocusChangeFunc,
      onDatesChange: this.onDateChangeFunc,
      startDatePlaceholderText,
      endDatePlaceholderText,
      disabled,
      isRTL,
      showClearDates: !!showClearDates,
      orientation,
      anchorDirection,
      withPortal,
      withFullScreenPortal,
      small,
      numberOfMonths: numberOfMonths || 2,
      block,
      regular,
      noBorder,
    };

    return (
      <ReactDatesStyleWrapper className={addAllClasses.join(' ')}>
        <DateRangePicker {...defaultCalenderProps} />
      </ReactDatesStyleWrapper>
    );
  }
}

DateRangePickerBox.propTypes = {
  startDateId: PropTypes.string.isRequired,
  endDateId: PropTypes.string.isRequired,
  startDatePlaceholderText: PropTypes.string,
  endDatePlaceholderText: PropTypes.string,
  disabled: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.oneOf(['START_DATE', 'END_DATE']),
  ]),
  showClearDates: PropTypes.bool,
  isRTL: PropTypes.bool,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  anchorDirection: PropTypes.oneOf(['left', 'right']),
  withPortal: PropTypes.bool,
  withFullScreenPortal: PropTypes.bool,
  small: PropTypes.bool,
  numberOfMonths: PropTypes.number,
  block: PropTypes.bool,
  regular: PropTypes.bool,
  noBorder: PropTypes.bool,
  updateSearchData: PropTypes.func,
};

export default DateRangePickerBox;
