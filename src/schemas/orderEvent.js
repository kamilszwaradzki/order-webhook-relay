const { z } = require('zod');

const orderEventSchema = z.object({
    event_id: z.string().min(1, 'event_id is required'),

    type: z.literal('order.created'),

    data: z.object({
        order_id: z.string().min(1, 'order_id is required'),

        customer_email: z.string()
            .min(1, 'customer_email is required')
            .refine(
                (email) => email.includes('@'),
                'customer_email must contain @'
            ),

        total: z.string()
            .regex(
                /^\d{1,8}(\.\d{1,2})?$/,
                'total must be between 0 and 99999999.99'
            ),

        currency: z.string()
            .regex(/^[A-Z]{3}$/, 'currency must contain 3 uppercase letters')
            .default('PLN'),
    }),
});

module.exports = {
    orderEventSchema,
};
