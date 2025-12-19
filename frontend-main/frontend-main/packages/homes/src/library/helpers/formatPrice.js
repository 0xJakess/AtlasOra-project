export const formatPrice = (price, currency = 'USD') => {
    const numericPrice = Number(price);
    if (isNaN(numericPrice)) return price;

    // Ensure currency is a valid 3-letter code, otherwise fallback to USD
    const validCurrency = currency && currency.length === 3 ? currency : 'USD';

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: validCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numericPrice);
    } catch (error) {
        console.warn(`Invalid currency code: ${currency}, falling back to USD`);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numericPrice);
    }
};

export default formatPrice;
