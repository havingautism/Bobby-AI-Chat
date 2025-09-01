import React, { useState, useEffect } from "react";
import { getCurrentLanguage, setLanguage, t } from "../utils/language";
import "./LanguageToggle.css";

const LanguageToggle = () => {
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: "zh", name: "中文", flag: "🇨🇳" },
    { code: "en", name: "English", flag: "🇺🇸" }
  ];

  useEffect(() => {
    const handleLanguageChange = (event) => {
      setCurrentLanguage(event.detail);
    };

    window.addEventListener("languageChanged", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
    };
  }, []);

  const handleLanguageSelect = (languageCode) => {
    setLanguage(languageCode);
    setCurrentLanguage(languageCode);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const currentLanguageData = languages.find(lang => lang.code === currentLanguage);

  return (
    <div className="language-toggle-container">
      <button
        className={`language-toggle-btn ${isOpen ? "open" : ""}`}
        onClick={toggleDropdown}
        title={t("language", currentLanguage)}
      >
        {/* 地球图标 */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="language-code">{currentLanguageData?.code.toUpperCase()}</span>
        <svg
          className="dropdown-arrow"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="language-options">
          {languages.map((language) => (
            <button
              key={language.code}
              className={`language-option ${currentLanguage === language.code ? "active" : ""}`}
              onClick={() => handleLanguageSelect(language.code)}
            >
              <span className="flag">{language.flag}</span>
              <span className="name">{language.name}</span>
              {currentLanguage === language.code && (
                <svg
                  className="check"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 12 2 2 4-4" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageToggle;
