import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FiLock, FiLogOut } from 'react-icons/fi';
import { Button } from '../components/common/Button';

const SubscriptionPage: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FiLock className="w-8 h-8 text-red-600" />
                    </div>
                    
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        Account Inactive
                    </h1>
                    
                    <p className="text-slate-600 mb-6">
                        Hello <strong>{user?.name}</strong>. Your account is currently inactive or your subscription has expired.
                    </p>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-left">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">What to do?</h3>
                        <p className="text-sm text-blue-700">
                            Please contact the administrator to activate your account. Once activated, you will have full access to all features for 30 days.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Button 
                            onClick={logout}
                            variant="secondary"
                            className="w-full justify-center"
                            icon={<FiLogOut className="w-4 h-4" />}
                        >
                            Logout
                        </Button>
                    </div>
                </div>
                
                <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">
                        Finance Tracker App &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
