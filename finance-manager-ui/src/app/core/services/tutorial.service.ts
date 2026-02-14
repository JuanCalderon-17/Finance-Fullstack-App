import { Injectable } from '@angular/core';
import { driver, DriveStep } from 'driver.js';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  
  constructor(private translate: TranslateService) {}

  shouldShowTutorial(): boolean {
    return !localStorage.getItem('tutorial-completed');
  }

  markTutorialAsCompleted(): void {
    localStorage.setItem('tutorial-completed', 'true');
  }

  resetTutorial(): void {
    localStorage.removeItem('tutorial-completed');
  }

  startDashboardTutorial(): void {
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: this.getDashboardSteps(),
      nextBtnText: this.translate.instant('TUTORIAL.NEXT'),
      prevBtnText: this.translate.instant('TUTORIAL.PREVIOUS'),
      doneBtnText: this.translate.instant('TUTORIAL.DONE'),
      onDestroyed: () => {
        this.markTutorialAsCompleted();
      },
      popoverClass: 'custom-driver-popover',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
    });

    driverObj.drive();
  }

  private getDashboardSteps(): DriveStep[] {
    return [
      {
        element: '.stats-section', 
        popover: {
          title: this.translate.instant('TUTORIAL.WELCOME_TITLE'),
          description: this.translate.instant('TUTORIAL.WELCOME_DESC'),
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.form-card',
        popover: {
          title: this.translate.instant('TUTORIAL.ADD_TRANSACTION_TITLE'),
          description: this.translate.instant('TUTORIAL.ADD_TRANSACTION_DESC'),
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.settings-dropdown-container',
        popover: {
          title: this.translate.instant('TUTORIAL.CURRENCY_TITLE'),
          description: this.translate.instant('TUTORIAL.CURRENCY_DESC'),
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '.history-header',
        popover: {
          title: this.translate.instant('TUTORIAL.FILTERS_TITLE'),
          description: this.translate.instant('TUTORIAL.FILTERS_DESC'),
          side: 'left',
          align: 'start'
        }
      },
      {
        element: '.chart-container',
        popover: {
          title: this.translate.instant('TUTORIAL.CHART_TITLE'),
          description: this.translate.instant('TUTORIAL.CHART_DESC'),
          side: 'left',
          align: 'center'
        }
      },
      {
        element: 'a[routerLink="/savings"]',
        popover: {
          title: this.translate.instant('TUTORIAL.NAVIGATION_TITLE'),
          description: this.translate.instant('TUTORIAL.NAVIGATION_DESC'),
          side: 'bottom',
          align: 'center'
        }
      },
      {
        popover: {
          title: this.translate.instant('TUTORIAL.FINISH_TITLE'),
          description: this.translate.instant('TUTORIAL.FINISH_DESC'),
          side: 'left',
          align: 'center'
        }
      }
    ];
  }

// Tutorial para Savings
startSavingsTutorial(): void {
  const driverObj = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    steps: this.getSavingsSteps(),
    nextBtnText: this.translate.instant('TUTORIAL.NEXT'),
    prevBtnText: this.translate.instant('TUTORIAL.PREVIOUS'),
    doneBtnText: this.translate.instant('TUTORIAL.DONE'),
    onDestroyed: () => {
      localStorage.setItem('tutorial-savings-completed', 'true');
    },
    popoverClass: 'custom-driver-popover',
    overlayColor: 'rgba(0, 0, 0, 0.75)',
  });

  driverObj.drive();
}

private getSavingsSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: this.translate.instant('TUTORIAL.SAVINGS.WELCOME_TITLE'),
        description: this.translate.instant('TUTORIAL.SAVINGS.WELCOME_DESC'),
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '.savings-form',
      popover: {
        title: this.translate.instant('TUTORIAL.SAVINGS.ADD_GOAL_TITLE'),
        description: this.translate.instant('TUTORIAL.SAVINGS.ADD_GOAL_DESC'),
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '.savings-list',
      popover: {
        title: this.translate.instant('TUTORIAL.SAVINGS.MANAGE_TITLE'),
        description: this.translate.instant('TUTORIAL.SAVINGS.MANAGE_DESC'),
        side: 'left',
        align: 'start'
      }
    },
    {
      popover: {
        title: this.translate.instant('TUTORIAL.FINISH_TITLE'),
        description: this.translate.instant('TUTORIAL.FINISH_DESC'),
        side: 'bottom',
        align: 'center'
      }
    }
  ];
}

// Tutorial para Debts
startDebtsTutorial(): void {
  const driverObj = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    steps: this.getDebtsSteps(),
    nextBtnText: this.translate.instant('TUTORIAL.NEXT'),
    prevBtnText: this.translate.instant('TUTORIAL.PREVIOUS'),
    doneBtnText: this.translate.instant('TUTORIAL.DONE'),
    onDestroyed: () => {
      localStorage.setItem('tutorial-debts-completed', 'true');
    },
    popoverClass: 'custom-driver-popover',
    overlayColor: 'rgba(0, 0, 0, 0.75)',
  });

  driverObj.drive();
}

private getDebtsSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: this.translate.instant('TUTORIAL.DEBTS.WELCOME_TITLE'),
        description: this.translate.instant('TUTORIAL.DEBTS.WELCOME_DESC'),
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '.debts-form',
      popover: {
        title: this.translate.instant('TUTORIAL.DEBTS.ADD_DEBT_TITLE'),
        description: this.translate.instant('TUTORIAL.DEBTS.ADD_DEBT_DESC'),
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '.debts-list',
      popover: {
        title: this.translate.instant('TUTORIAL.DEBTS.MANAGE_TITLE'),
        description: this.translate.instant('TUTORIAL.DEBTS.MANAGE_DESC'),
        side: 'left',
        align: 'start'
      }
    },
    {
      popover: {
        title: this.translate.instant('TUTORIAL.FINISH_TITLE'),
        description: this.translate.instant('TUTORIAL.FINISH_DESC'),
        side: 'right',
        align: 'center'
      }
    }
  ];
}

shouldShowSavingsTutorial(): boolean {
  return !localStorage.getItem('tutorial-savings-completed');
}

shouldShowDebtsTutorial(): boolean {
  return !localStorage.getItem('tutorial-debts-completed');
}
}