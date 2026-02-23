import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

export const getLearningPath = (topicId) =>
  api.get(`/topics/${topicId}/path`)

export const getUnlocked = (topicId, masteredIds) =>
  api.post(`/topics/${topicId}/unlocked`, { mastered_ids: masteredIds })

export const getFrontier = (topicId, masteredIds) =>
  api.post(`/topics/${topicId}/frontier`, { mastered_ids: masteredIds })

export const getTopicConcepts = (topicId) =>
  api.get(`/topics/${topicId}/path`)

export const aiExplain = (concept_name, concept_description, mastered_names) =>
  api.post('/ai/explain', { concept_name, concept_description, mastered_names })

export const aiSuggest = (mastered_names, unlocked_names, frontier_names) =>
  api.post('/ai/suggest', { mastered_names, unlocked_names, frontier_names })

export const aiQuiz = (concept_name, mastered_names) =>
  api.post('/ai/quiz', { concept_name, mastered_names })