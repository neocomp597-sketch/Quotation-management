import { useState, useCallback } from 'react';

/**
 * Reusable hook to prevent double submission/execution of async operations.
 * @param {Function} submitFn - The async function to execute.
 * @returns {Object} { isSubmitting: boolean, execute: function }
 */
export const useSubmitGuard = (submitFn) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const execute = useCallback(async (...args) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            return await submitFn(...args);
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, submitFn]);

    return { isSubmitting, execute };
};
