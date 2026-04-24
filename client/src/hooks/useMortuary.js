import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { mortuaryDashboardAPI, contributionAPI, claimAPI } from '../services/api';

export const useMortuary = () => {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [myContributions, setMyContributions] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch real data from API
  useEffect(() => {
    const fetchMortuaryData = async () => {
      if (user && token) {
        setLoading(true);
        try {
          // Fetch profile data
          const dashboardData = await mortuaryDashboardAPI.getDashboard(user.memberId);
          setProfile(dashboardData.profile);

          // Fetch contributions
          const contributionsData = await contributionAPI.getContributionHistory(user.memberId);
          setMyContributions(contributionsData.contributions || []);

          // Fetch claims
          const claimsData = await claimAPI.getClaimHistory(user.memberId);
          setMyClaims(claimsData.claims || []);
        } catch (error) {
          console.error('Error fetching mortuary data:', error);
          // Set empty data on error
          setProfile(null);
          setMyContributions([]);
          setMyClaims([]);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMortuaryData();
  }, [user, token]);

  const updateProfile = async (profileData) => {
    setLoading(true);
    try {
      // Make actual API call to update profile
      const response = await fetch(`/api/mortuary/profile/${user.memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(prev => ({ ...prev, ...updatedProfile }));
        return { success: true };
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (file && user && token) {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch(`/api/mortuary/profile/${user.memberId}/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          setProfile(prev => ({ ...prev, avatar_url: result.avatar_url }));
        } else {
          throw new Error('Failed to upload avatar');
        }
      } catch (error) {
        console.error('Error uploading avatar:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return {
    profile,
    myContributions,
    myClaims,
    loading,
    updateProfile,
    handleAvatarUpload,
  };
};