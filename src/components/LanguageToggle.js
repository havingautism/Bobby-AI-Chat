import React, { useState, useEffect } from "react";
import { getCurrentLanguage, setLanguage, LANGUAGES } from "../utils/language";
import "./LanguageToggle.css";

const LanguageToggle = () => {
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleLanguageChange = (event) => {
      setCurrentLang(event.detail);
    };

    window.addEventListener("languageChanged", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
    };
  }, []);

  const handleLanguageSelect = (langCode) => {
    setLanguage(langCode);
    setCurrentLang(langCode);
    setIsOpen(false);
  };

  const currentLanguage = LANGUAGES[currentLang];
  const otherLanguages = Object.values(LANGUAGES).filter(
    (lang) => lang.code !== currentLang
  );

  return (
    <div className="language-toggle">
      <button
        className="language-toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        title="切换语言 / Switch Language"
      >
        <span className="language-flag">{currentLanguage.flag}</span>
        <span className="language-code">{currentLanguage.code.toUpperCase()}</span>
        <span className={`dropdown-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="language-dropdown">
          {otherLanguages.map((lang) => (
            <button
              key={lang.code}
              className="language-option"
              onClick={() => handleLanguageSelect(lang.code)}
            >
              <span className="language-flag">{lang.flag}</span>
              <span className="language-name">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageToggle;
