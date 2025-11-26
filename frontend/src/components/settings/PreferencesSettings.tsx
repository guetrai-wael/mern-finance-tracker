import React, { useState, useEffect } from "react";
import { FiGlobe, FiSettings, FiBell } from "react-icons/fi";
import { useCurrency } from "../../hooks/useCurrency";
import { useToast } from "../../hooks/useToast";
import { COUNTRIES, type Country } from "../../utils/countries";

const PreferencesSettings: React.FC = () => {
  const { currency, setCurrency } = useCurrency();
  const { showSuccess } = useToast();

  const [selectedCountry, setSelectedCountry] = useState(() => {
    const savedCurrency = localStorage.getItem("preferred_currency") || "USD";
    return COUNTRIES.find((c) => c.currency === savedCurrency) || COUNTRIES[0];
  });

  const [language, setLanguage] = useState(
    () => localStorage.getItem("preferred_language") || "en"
  );

  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("email_notifications") !== "false"
  );

  // Update currency when country changes
  useEffect(() => {
    if (selectedCountry.currency !== currency) {
      setCurrency(selectedCountry.currency);
    }
  }, [selectedCountry, currency, setCurrency]);

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    setCurrency(country.currency);
    showSuccess(`Currency changed to ${country.currency}`);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    localStorage.setItem("preferred_language", newLanguage);
    showSuccess("Language preference updated");
  };

  const handleNotificationsChange = (enabled: boolean) => {
    setNotifications(enabled);
    localStorage.setItem("email_notifications", enabled.toString());
    showSuccess(`Email notifications ${enabled ? "enabled" : "disabled"}`);
  };

  return (
    <div className="space-y-6">
      {/* Currency & Region */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <FiGlobe className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Currency & Region
            </h3>
            <p className="text-sm text-gray-600">
              Choose your preferred currency and region
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Country/Currency
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountryChange(country)}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  selectedCountry.code === country.code
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{country.flag}</span>
                  <div>
                    <div className="font-medium text-sm">{country.name}</div>
                    <div className="text-xs text-gray-500">
                      {country.currency}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Selected:</strong> {selectedCountry.flag}{" "}
              {selectedCountry.name} ({selectedCountry.currency})
            </p>
          </div>
        </div>
      </div>

      {/* Language Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FiSettings className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Language</h3>
            <p className="text-sm text-gray-600">
              Choose your preferred language
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="language"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Interface Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <FiBell className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Notifications
            </h3>
            <p className="text-sm text-gray-600">
              Manage your notification preferences
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                Email Notifications
              </h4>
              <p className="text-sm text-gray-600">
                Receive email updates about your account
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => handleNotificationsChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between opacity-50">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                Budget Alerts
              </h4>
              <p className="text-sm text-gray-600">
                Get notified when approaching budget limits
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-gray-400"></div>
            </label>
          </div>

          <div className="flex items-center justify-between opacity-50">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                Monthly Reports
              </h4>
              <p className="text-sm text-gray-600">
                Receive monthly financial summaries
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input
                type="checkbox"
                checked={false}
                disabled
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer"></div>
            </label>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Additional notification settings will be available in future
            updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PreferencesSettings;
