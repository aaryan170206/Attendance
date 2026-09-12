export const getAttendanceValue = (status?: string) => {
  switch (status) {
    case "present":
      return 1;

    case "absent":
      return 0;

    case "leftEarly":
      return 0.5;

    case "partial":
      return 0.5;

    case "club":
      return null;

    default:
      return null;
  }
};

export const calculateAttendance = (
  attendance: any,
  subjectName: string,
  type: "theory" | "lab"
) => {
  let attendedClasses = 0;
  let totalClasses = 0;
  let clubClasses = 0;

  for (const date in attendance) {
    const status = attendance[date]?.[subjectName]?.[type];

    if (!status) continue;

    if (status === "noClass" || status === "noLab") {
      continue;
    }

    if (status === "club") {
      clubClasses++;
      continue;
    }

    const value = getAttendanceValue(status);

    if (value === null) continue;

    totalClasses++;
    attendedClasses += value;
  }

  const percentage =
  totalClasses === 0
    ? 0
    : (attendedClasses / totalClasses) * 100;

  return {
    attendedClasses,
    totalClasses,
    percentage,
    clubClasses,
  };
};

export const calculateOverallLabAttendance = (
  attendance: any
) => {
  let attendedLabs = 0;
  let totalLabs = 0;

  Object.values(attendance).forEach((day: any) => {
    Object.values(day).forEach((subject: any) => {
      const status = subject.lab;

      if (
        !status ||
        status === "noLab" ||
        status === "noClass"
      ) {
        return;
      }

      const value = getAttendanceValue(status);

      if (value !== null) {
        attendedLabs += value;
        totalLabs += 1;
      }
    });
  });

  const percentage =
  totalLabs === 0
    ? 0
    : (attendedLabs / totalLabs) * 100;

  return {
    attendedLabs,
    totalLabs,
    percentage,
  };
};

export const calculateOverallTheoryAttendance = (
  attendance: any
) => {
  let attendedTheory = 0;
  let totalTheory = 0;
  let clubClasses = 0;

  Object.values(attendance).forEach((day: any) => {
    Object.values(day).forEach((subject: any) => {
      const status = subject.theory;

      if (
        !status ||
        status === "noClass"
      ) {
        return;
      }

      if (status === "club") {
        clubClasses++;
        return;
      }

      const value = getAttendanceValue(status);

      if (value !== null) {
        attendedTheory += value;
        totalTheory += 1;
      }
    });
  });

  const percentage =
    totalTheory === 0
      ? 0
      : (attendedTheory / totalTheory) * 100;

  return {
    attendedTheory,
    totalTheory,
    percentage,
  };
};

export const calculateOverallAttendance = (
  attendance: any
) => {
  let attendedClasses = 0;
  let totalClasses = 0;
  let clubClasses = 0;

  Object.values(attendance).forEach((day: any) => {
    Object.values(day).forEach((subject: any) => {

      ["theory", "lab"].forEach((type) => {
        const status = subject[type];

        if (
          !status ||
          status === "noClass" ||
          status === "noLab"
        ) {
          return;
        }

        if (type === "theory" && status === "club") {
          clubClasses++;
          return;
        }

        const value = getAttendanceValue(status);

        if (value !== null) {
          attendedClasses += value;
          totalClasses += 1;
        }
      });
    });
  });

  const percentage =
    totalClasses === 0
      ? 0
      : (attendedClasses / totalClasses) * 100;

  return {
    attendedClasses,
    totalClasses,
    percentage,
  };
};

export const calculateClubClasses = (attendance: any) => {
  let clubClasses = 0;

  Object.values(attendance).forEach((day: any) => {
    Object.values(day).forEach((subject: any) => {
      if (subject.theory === "club") {
        clubClasses++;
      }
    });
  });

  return clubClasses;
};

export const calculateAttendanceTrend = (attendance: any) => {
  const dates = Object.keys(attendance).sort();

  let attendedClasses = 0;
  let totalClasses = 0;

  return dates.map((date) => {
    const day = attendance[date];

    Object.values(day).forEach((subject: any) => {
      ["theory", "lab"].forEach((type) => {
        const status = subject[type];

        if (
          !status ||
          status === "noClass" ||
          status === "noLab" ||
          status === "club"
        ) {
          return;
        }

        const value = getAttendanceValue(status);

        if (value !== null) {
          attendedClasses += value;
          totalClasses += 1;
        }
      });
    });

    const percentage =
      totalClasses === 0
        ? 0
        : (attendedClasses / totalClasses) * 100;

    return {
      date,
      percentage,
    };
  });
};