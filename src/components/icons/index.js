import React from 'react';

// DeepSeek Icon
const DeepSeek = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="DeepSeek"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Qwen Icon
const Qwen = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Qwen"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/qwen-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Kimi Icon
const Kimi = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Kimi"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/kimi-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// ChatGLM Icon
const ChatGLM = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="ChatGLM"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/chatglm-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Baidu Icon
const Baidu = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Baidu"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/baidu-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Tencent Icon
const Tencent = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Tencent"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/tencent-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Stepfun Icon
const Stepfun = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Stepfun"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/stepfun-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Minimax Icon
const Minimax = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Minimax"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/minimax-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// Gemma Icon
const Gemma = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="Gemma"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemma-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

// OpenAI Icon
const OpenAI = React.memo(({ size = '1em', style = {}, ...rest }) => (
  <img
    alt="OpenAI"
    height={size}
    src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai-color.svg`}
    style={{ flex: 'none', lineHeight: 1, display: 'inline-block', ...style }}
    width={size}
    {...rest}
  />
));

export {
  DeepSeek,
  Qwen,
  Kimi,
  ChatGLM,
  Baidu,
  Tencent,
  Stepfun,
  Minimax,
  Gemma,
  OpenAI
};