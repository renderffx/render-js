import { describe, it, expect } from 'vitest';
import {
  VERCEL_NATIVE,
  isVercelNative,
  getVercelRegion,
  getVercelDeploymentUrl,
  isVercelPreview,
  getGitCommitSha,
  getBranchName,
  getVercelEnv,
} from '@renderjs/core';

describe('Vercel Native', () => {
  describe('VERCEL_NATIVE constant', () => {
    it('should be true', () => {
      expect(VERCEL_NATIVE).toBe(true);
    });
  });

  describe('isVercelNative', () => {
    it('should return true', () => {
      expect(isVercelNative()).toBe(true);
    });
  });

  describe('getVercelRegion', () => {
    it('should return a string', () => {
      const region = getVercelRegion();
      expect(typeof region).toBe('string');
    });

    it('should fallback to environment variable', () => {
      const region = getVercelRegion();
      expect(region).toBeDefined();
    });
  });

  describe('getVercelDeploymentUrl', () => {
    it('should return a string', () => {
      const url = getVercelDeploymentUrl();
      expect(typeof url).toBe('string');
    });
  });

  describe('isVercelPreview', () => {
    it('should return boolean', () => {
      const isPreview = isVercelPreview();
      expect(typeof isPreview).toBe('boolean');
    });
  });

  describe('getGitCommitSha', () => {
    it('should return undefined when not in Vercel', () => {
      const sha = getGitCommitSha();
      expect(sha).toBeUndefined();
    });
  });

  describe('getBranchName', () => {
    it('should return undefined when not in Vercel', () => {
      const branch = getBranchName();
      expect(branch).toBeUndefined();
    });
  });

  describe('getVercelEnv', () => {
    it('should return complete env object', () => {
      const env = getVercelEnv();
      
      expect(env).toBeDefined();
      expect(typeof env.region).toBe('string');
      expect(typeof env.url).toBe('string');
      expect(typeof env.isPreview).toBe('boolean');
      expect(typeof env.isProduction).toBe('boolean');
      expect(typeof env.isDev).toBe('boolean');
    });

    it('should have correct development flag', () => {
      const env = getVercelEnv();
      expect(env.isDev).toBe(process.env.NODE_ENV === 'development');
    });
  });
});

describe('Vercel Config', () => {
  it('should export Vercel-related functions', () => {
    expect(typeof VERCEL_NATIVE).toBe('boolean');
    expect(typeof isVercelNative).toBe('function');
    expect(typeof getVercelRegion).toBe('function');
    expect(typeof getVercelDeploymentUrl).toBe('function');
    expect(typeof isVercelPreview).toBe('function');
    expect(typeof getGitCommitSha).toBe('function');
    expect(typeof getBranchName).toBe('function');
    expect(typeof getVercelEnv).toBe('function');
  });
});
