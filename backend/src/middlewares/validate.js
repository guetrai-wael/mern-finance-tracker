/* Request validation middleware for Joi schemas */
module.exports = function (schema) {
    return (req, res, next) => {
        const toValidate = {};
        if (req.body && Object.keys(req.body).length) toValidate.body = req.body;
        if (req.params && Object.keys(req.params).length) toValidate.params = req.params;
        if (req.query && Object.keys(req.query).length) toValidate.query = req.query;
        
        const { error } = schema.validate(toValidate, { abortEarly: false });
        if (error) return res.status(400).json({ 
            message: 'Validation Error', 
            details: error.details.map(d => d.message) 
        });
        next();
    };
};
