const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const router = express.Router();

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(verifyJwt);

router.post('/create', async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.userId;
    const newProject = await prisma.project.create({
      data: {
        name,
        projectMembers: {
          create: {
            roleName: 'Admin',
            userId: userId
          }
        }
      },
      include: {
        projectMembers: true
      }
    });
    res.status(201).json({ project: newProject });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my-projects', async (req, res) => {
  try {
    const userId = req.userId;
    const projects = await prisma.project.findMany({
      where: {
        projectMembers: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        projectMembers: true
      }
    });
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/invitations', async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const invitations = await prisma.invitation.findMany({
      where: { inviteeEmail: user.email, status: 'PENDING' },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ invitations });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/invitations/:invitationId/respond', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    if (status !== 'ACCEPTED' && status !== 'REJECTED') {
      return res.status(400).json({ error: 'Status must be ACCEPTED or REJECTED.' });
    }

    const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation has already been responded to.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.inviteeEmail) {
      return res.status(403).json({ error: 'This invitation is not addressed to you.' });
    }

    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status }
    });

    if (status === 'ACCEPTED') {
      const existing = await prisma.projectMember.findFirst({
        where: { projectId: invitation.projectId, userId }
      });
      if (!existing) {
        await prisma.projectMember.create({
          data: { roleName: 'Collaborator', userId, projectId: invitation.projectId }
        });
      }
    }

    res.json({ invitation: updatedInvitation });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const files = await prisma.file.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' }
    });
    const buildTree = (items, parentId = null) =>
      items
        .filter(f => f.parentId === parentId)
        .map(f => ({ ...f, children: buildTree(items, f.id) }));
    res.json({ files: buildTree(files) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, parentId } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const file = await prisma.file.create({
      data: {
        name,
        type,
        parentId: parentId || null,
        projectId: id
      }
    });
    res.status(201).json({ file });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/:id/files/:fileId', async (req, res) => {
  try {
    const { id, fileId } = req.params;
    const { content } = req.body;
    const file = await prisma.file.update({
      where: { id: fileId },
      data: { content }
    });
    res.json({ file });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.delete('/:id/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const deleteSubtree = async (id) => {
      const children = await prisma.file.findMany({ where: { parentId: id } });
      for (const child of children) {
        await deleteSubtree(child.id);
      }
      await prisma.file.delete({ where: { id } });
    };
    await deleteSubtree(fileId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    const result = members.map(m => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.roleName
    }));
    res.json({ members: result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/:id/invite', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const requestingUserId = req.userId;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const requestingMember = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: requestingUserId }
    });
    if (!requestingMember) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    const inviter = await prisma.user.findUnique({ where: { id: requestingUserId } });
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return res.status(404).json({ error: `No user found with email "${email}".` });
    }

    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: targetUser.id }
    });
    if (existingMember) {
      return res.status(400).json({ error: `${email} is already a member of this project.` });
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { projectId: id, inviteeEmail: email, status: 'PENDING' }
    });
    if (existingInvite) {
      return res.status(400).json({ error: `A pending invitation already exists for ${email}.` });
    }

    await prisma.invitation.create({
      data: {
        projectId: id,
        inviterEmail: inviter?.email || '',
        inviteeEmail: email,
        status: 'PENDING'
      }
    });

    res.status(201).json({ message: `Invitation sent to ${email}. They will see it on their Dashboard.` });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/:id/issues', async (req, res) => {
  try {
    const { id } = req.params;
    const issues = await prisma.issue.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ issues });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/:id/issues', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const requestingUserId = req.userId;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: requestingUserId } });
    const authorName = user?.name || 'Unknown';

    const issue = await prisma.issue.create({
      data: {
        title: title.trim(),
        status: 'open',
        authorName,
        projectId: id
      }
    });

    res.status(201).json({ issue });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.patch('/:id/issues/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { status } = req.body;
    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: { status }
    });
    res.json({ issue });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/:id/role-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedRole } = req.body;
    const userId = req.userId;

    const allowedRoles = ['Maintainer', 'Manager'];
    if (!allowedRoles.includes(requestedRole)) {
      return res.status(400).json({ error: 'You can only request Maintainer or Manager roles.' });
    }

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId }
    });
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }
    if (member.roleName === 'Admin') {
      return res.status(400).json({ error: 'Admins cannot submit role requests.' });
    }

    const existing = await prisma.roleRequest.findUnique({
      where: { userId_projectId: { userId, projectId: id } }
    });
    if (existing && existing.status === 'PENDING') {
      return res.status(400).json({ error: 'You already have a pending role request for this project.' });
    }

    const roleRequest = await prisma.roleRequest.upsert({
      where: { userId_projectId: { userId, projectId: id } },
      update: { requestedRole, status: 'PENDING', createdAt: new Date() },
      create: { userId, projectId: id, requestedRole, status: 'PENDING' }
    });

    res.status(201).json({ roleRequest });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/:id/role-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const adminMember = await prisma.projectMember.findFirst({
      where: { projectId: id, userId, roleName: 'Admin' }
    });
    if (!adminMember) {
      return res.status(403).json({ error: 'Only the project Admin can view role requests.' });
    }

    const roleRequests = await prisma.roleRequest.findMany({
      where: { projectId: id, status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ roleRequests });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.patch('/:id/role-requests/:requestId', async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED.' });
    }

    const adminMember = await prisma.projectMember.findFirst({
      where: { projectId: id, userId, roleName: 'Admin' }
    });
    if (!adminMember) {
      return res.status(403).json({ error: 'Only the project Admin can respond to role requests.' });
    }

    const roleRequest = await prisma.roleRequest.findUnique({ where: { id: requestId } });
    if (!roleRequest || roleRequest.projectId !== id) {
      return res.status(404).json({ error: 'Role request not found.' });
    }
    if (roleRequest.status !== 'PENDING') {
      return res.status(400).json({ error: 'This request has already been processed.' });
    }

    const updatedRequest = await prisma.roleRequest.update({
      where: { id: requestId },
      data: { status }
    });

    if (status === 'APPROVED') {
      await prisma.projectMember.updateMany({
        where: { projectId: id, userId: roleRequest.userId },
        data: { roleName: roleRequest.requestedRole }
      });
    }

    res.json({ roleRequest: updatedRequest });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/:id/my-role-request', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const roleRequest = await prisma.roleRequest.findUnique({
      where: { userId_projectId: { userId, projectId: id } }
    });

    res.json({ roleRequest: roleRequest || null });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

module.exports = router;
